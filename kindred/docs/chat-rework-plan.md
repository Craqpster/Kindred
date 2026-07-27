# Chat rework: Stream → Supabase Realtime

> **Status, 2026-07-27.** Stream is gone: both packages, the SDK, the token route, the games
> UI, 252 lines of `.str-chat` CSS, and the env vars. The app builds, typechecks, and lints
> clean, and the new chat works end to end — a wave creates a conversation, the bot posts an
> icebreaker, and a message goes through moderation into Postgres.
>
> Phases 1, 2, 3, 4, 7 and 8 are done. Phase 3's one open question — whether the browser
> socket authenticates as the user or as `anon` — was settled by reading supabase-js rather
> than by staging two accounts; see "Verify early" below. It needs no code, and the manual
> `setAuth()` call the plan expected to add would have made things worse.
>
> The last of Stream went out on 2026-07-27: `groups.stream_channel_id`, the dead
> `kindred-bot` module, and the three API routes section 1 predicted would disappear
> (`/api/chat-prompts`, `/api/chat-xp`, `/api/moderate-message` — `/api/confidence` went
> earlier). Two of those still answered for any `conversationId` the caller named, with no
> membership check, so removing them closed a real hole rather than just tidying.
>
> That cleanup also fixed a live bug: `FindGroupCard` gated on `stream_channel_id`, which
> nothing had written since Stream was removed. It was permanently NULL, so **every** grouped
> user saw "Still setting up this chat" instead of their group. The card now reads the
> conversation relation.
>
> **Reactions are done** (2026-07-27), the first slice of phase 6. The table, RLS grant,
> types, mapping and read path had all existed since phase 1 with no write path at all — no
> mutation, no action, no UI. `toggleReaction` closes that, membership-checked like every
> other write, with a closed emoji allowlist shared by the picker and the server validator so
> the two cannot drift. `npm run verify:reactions` covers the state machine.
>
> One thing worth knowing rather than discovering: **Realtime does not RLS-filter DELETEs**,
> because a delete payload carries only the replica identity and a policy needs a full row.
> Reaction *additions* are filtered per subscriber; *removals* go to everyone. `applyReaction`
> ignores message ids the client is not holding, so nothing renders — but the tuple does reach
> the wire. Fixing it properly means soft-deleting reactions so removal becomes an UPDATE, and
> that is a schema change worth making deliberately.
>
> **The XP ring is done** (2026-07-27), the first slice of phase 5. XP had been awarded on
> every qualifying message since phase 2 and displayed nowhere — `/api/chat-xp` served it
> once, and that route had no callers left by the time it was deleted. The conversation
> header now carries a level ring with a popover, and `chatLevelToast`/`dailyBonusToast` in
> sharedToasts.ts — dead since the Stream removal — are raised again.
>
> `channel_xp` is not in the realtime publication, and it stays out: every XP change is
> caused by a message, and messages *are* realtime, so the message is the cue to re-read.
> Own sends do not even need that, since `sendMessage` already returns the new total.
>
> Found while checking the level maths: `getChatLevel` clamped with
> `Math.max(0, Math.floor(xp))`, which stops neither NaN nor Infinity — and the two fail in
> opposite ways. NaN reaches the SVG as a NaN `strokeDashoffset` and draws nothing; Infinity
> makes `while (safeXp >= …)` never terminate and hangs the render. Neither is reachable from
> an integer column, so this was hardening rather than a live bug, but `verify:xp` now pins
> it — and demonstrates the hang if the guard is removed.
>
> Still to come: the rest of phase 5 (games, presence, typing, the richer icebreaker card)
> and the rest of phase 6 — threads, edit, delete, pin.

Replacing Stream Chat with our own tables plus Supabase Realtime, and rebuilding the chat
surface so it reads like one design instead of a pile of workarounds around someone else's SDK.

Decisions already made:

- **Attachments:** text only in v1. No uploads, no Supabase Storage bucket yet.
- **Existing data:** XP and game history are preserved (remapped off Stream ids). Message
  history is not imported.
- **Cutover:** one branch (`feat/supabase-chat`), Stream deleted in the same branch. No feature flag.

---

## 1. Why this is a net simplification, not just a swap

Stream owns three things today that Postgres would own better:

| Today | After |
| --- | --- |
| `lib/confidence.ts` queries Stream for the last 5 messages to decide "was this a real back-and-forth?" | One `ORDER BY created_at DESC LIMIT 2` on our own table |
| `channelMemberIds()` asks Stream who is in a channel, because a DM has no row in `group_members` | `conversation_members` — one table for DMs and groups |
| `promptReplyIsUnclaimed()` re-fetches the message from Stream to prove the client isn't lying about it | The send path *is* the server, so there is nothing to prove |
| Moderation runs in the browser, then the browser sends to Stream directly — a crafted client skips it | Moderation runs inside the send action, before the row exists |

Three whole route handlers exist only because the write path lives in the browser
(`/api/confidence`, `/api/chat-prompts`, `/api/moderate-message`). All three disappear.

The tradeoff, stated plainly: we take on read receipts, unread counts, typing, presence,
pagination, and reconnection — things Stream gave us for free. The estimates below account for that.

---

## 2. Schema

Four new tables. Everything else is a remap.

```prisma
/// A DM or a group chat. Replaces the Stream channel.
model conversations {
  id       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// 'dm' | 'group'. CHECK-constrained in the migration, like connections.status.
  kind     String
  /// Groups only; DMs title themselves from the other member.
  title    String?
  group_id String? @unique @db.Uuid

  /// The wave. requested_of non-null IS "pending" — same rule the Stream custom field
  /// encoded, now a column the Pending tab can filter on in SQL.
  requested_by String? @db.Uuid
  requested_of String? @db.Uuid

  /// least(a,b):greatest(a,b) for DMs, NULL for groups. This is what makes waving at the
  /// same person twice reuse the conversation — the unique index is the enforcement,
  /// replacing Stream's "distinct channel" behaviour.
  dm_key String? @unique

  /// Denormalized so the list sorts and previews without a per-row subquery.
  /// Maintained by a trigger on messages, never written by application code.
  last_message_at DateTime? @db.Timestamptz(6)
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
}

model conversation_members {
  conversation_id String   @db.Uuid
  profile_id      String   @db.Uuid
  /// Drives the unread badge. Bumped by markRead, which is the only thing that writes it.
  last_read_at    DateTime @default(now()) @db.Timestamptz(6)
  joined_at       DateTime @default(now()) @db.Timestamptz(6)

  @@id([conversation_id, profile_id])
  @@index([profile_id])
}

model messages {
  id              String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  conversation_id String @db.Uuid
  /// NULL means the Kindred bot. A bot profile row would need an auth.users row to FK
  /// against, and the bot has no account — so absence is the marker.
  sender_id       String? @db.Uuid

  /// 'text' | 'icebreaker_prompt' | 'prompt_response' | 'game_invite'.
  /// CHECK-constrained; this is what Stream's `messageType` custom field was.
  kind String @default("text")
  body String

  /// A quoted message (the reply arrow).
  reply_to_id String? @db.Uuid
  /// prompt_response only: which icebreaker this answers. Explicit columns rather than a
  /// metadata blob, so IcebreakerCard's "who answered this prompt" is a real index.
  prompt_id   String? @db.Uuid
  /// game_invite only.
  game_type   String?

  /// Threaded replies. NULL is a top-level message; non-NULL lives in that message's
  /// thread and is excluded from the main timeline.
  parent_id String? @db.Uuid

  /// Soft delete — the timeline keeps the slot, same as Stream's type: "deleted".
  deleted_at DateTime? @db.Timestamptz(6)
  edited_at  DateTime? @db.Timestamptz(6)
  pinned_at  DateTime? @db.Timestamptz(6)
  created_at DateTime  @default(now()) @db.Timestamptz(6)

  /// The main timeline is "top-level messages, newest first", so parent_id is part of the
  /// index rather than a filter applied after the fact.
  @@index([conversation_id, parent_id, created_at])
  @@index([parent_id])
  @@index([prompt_id])
}

/// One emoji from one person on one message. The composite primary key is what makes
/// reacting twice a no-op instead of a duplicate — same trick prompt_awards uses.
model message_reactions {
  message_id String   @db.Uuid
  profile_id String   @db.Uuid
  emoji      String
  created_at DateTime @default(now()) @db.Timestamptz(6)

  @@id([message_id, profile_id, emoji])
  @@index([message_id])
}
```

`message_reactions` joins `messages` and `conversations` in the realtime publication and gets
the same member-only SELECT policy, reached through its message's conversation.

Remaps of existing tables — `channel_cid` (a Stream string like `messaging:!members-abc`)
becomes `conversation_id uuid` with a real foreign key on all four:

- `channel_xp` — primary key changes from `channel_cid` to `conversation_id`
- `daily_chat_activity` — composite PK becomes `(conversation_id, profile_id, day)`
- `daily_bonus_awards` — composite PK becomes `(conversation_id, day)`
- `game_sessions.channel_cid` → `conversation_id`; `invite_message_id` becomes a uuid FK to `messages`

`prompt_awards.prompt_id` holds Stream message ids for prompts that will no longer exist, so
those rows get deleted during cutover and the column becomes a uuid FK to `messages`.

`groups.stream_channel_id` is replaced by `conversations.group_id` pointing the other way,
and `groups.title` stops being a copy that can drift — the conversation's title is the only one.

### Row Level Security — new to this codebase

Today nothing has RLS; Prisma connects as `postgres` and bypasses it, and the DAL is the only
gate. Realtime changes that: Postgres Changes are delivered to the browser client and filtered
**by RLS**, per subscriber. Without policies, either nobody receives anything or everybody
receives everything.

The rule that keeps this simple:

> **The browser client may only ever read. Every write goes through a server action on Prisma.**

So the three new tables get SELECT policies and nothing else — no INSERT/UPDATE/DELETE policy
exists, which means the browser cannot write even if it tries. Prisma is unaffected either way.

```sql
-- SECURITY DEFINER to break the recursion: a policy on conversation_members that queries
-- conversation_members would re-enter itself.
create function public.is_conversation_member(conv uuid) returns boolean
  language sql security definer stable as $$
    select exists (
      select 1 from public.conversation_members
      where conversation_id = conv and profile_id = auth.uid()
    );
  $$;

create policy "members read their conversations" on public.conversations
  for select using (public.is_conversation_member(id));
create policy "members read messages" on public.messages
  for select using (public.is_conversation_member(conversation_id));
create policy "members read membership" on public.conversation_members
  for select using (public.is_conversation_member(conversation_id));

alter publication supabase_realtime
  add table public.messages, public.conversations, public.conversation_members;
```

---

## 3. Realtime design

**One Supabase channel for the whole app shell, plus one per open conversation.**

### Shell channel — Postgres Changes, unfiltered

Mounted where `ChatConnectionProvider` is today (`app/(app)/layout.tsx` → `AppProviders`),
for the same reason it lives there now: toasts and unread badges have to work from `/meet`,
not only while `/chats` is open.

It subscribes to INSERT/UPDATE on `messages`, `conversations`, and `conversation_members`
with **no filter** — RLS is the filter. This one stream feeds:

- new message appearing in the open thread
- the conversation list reordering and its preview text
- unread badges
- the "someone waved at you" toast (a `conversation_members` INSERT where `requested_of` is you)
- pending → active (a `conversations` UPDATE clearing `requested_of`)
- group renames

`postgres_changes` filters only support one `column=eq.value`, so "messages in any of my
conversations" is not expressible as a filter — which is exactly why RLS does it instead.

**Scaling note, written down now so nobody rediscovers it later:** unfiltered Postgres Changes
means the Realtime server evaluates RLS per subscriber per change. Supabase's own guidance puts
the comfortable ceiling in the low hundreds of concurrent subscribers. That is far above where
this app is, and the escape hatch is known: move to Broadcast-from-database
(`realtime.broadcast_changes()` in an AFTER INSERT trigger, fanned out to a `user:<id>` topic,
authorized by an RLS policy on `realtime.messages`). Same client-side shape, different plumbing.

### Per-conversation channel — Broadcast + Presence

Ephemeral things that should never touch Postgres:

| Signal | Replaces |
| --- | --- |
| `typing` | Stream's typing events — already live via `ChannelPill.tsx`'s `useTypingContext` |
| `game_state` | `channel.sendEvent({ type: "game_state" })` in `useGameSync.ts` |
| `xp_updated`, `level_up`, `daily_bonus` | the three `channel.sendEvent` calls in `useModeratedSend.ts` / `ChannelLevelAvatar.tsx` |
| Presence | `useChatPresence.ts`'s watcher count → "Active now" |

Presence is a straight improvement: Stream's watcher count needed a whole file of explanation
about why it isn't the same as "online". Supabase Presence tracks exactly "has this conversation
open", which is what the pill already claims to say.

---

## 4. Code layout

The thing the current code is missing is a seam between "talking to the chat backend" and
"rendering chat". Stream's contexts are threaded through every component, so `IcebreakerCard`
imports `useChannelStateContext`, `useChatContext`, and a `LocalMessage` type just to draw a card.

```
lib/chat/
  types.ts        Conversation / Message / Member — the only shapes the client sees
  queries.ts      server-only reads: listConversations, getConversation, getMessages(cursor)
  mutations.ts    server-only writes: startDm, createGroupConversation, sendMessage,
                  markRead, renameGroup, acceptRequest, postIcebreaker
  realtime.ts     channel names + broadcast payload types, shared by client and server

app/(app)/chats/
  page.tsx        server: conversation list + first page of the open thread, no client fetch on load
  actions.ts      thin zod wrappers over lib/chat/mutations (unchanged pattern from today)

components/chat/
  ChatRealtimeProvider.tsx   one shell subscription; exposes conversations + unread via context
  useMessages.ts             thread state, realtime patching, cursor pagination
  ConversationList.tsx  ConversationRow.tsx  ChatTabs.tsx
  MessageThread.tsx     MessageBubble.tsx    Composer.tsx
  IcebreakerCard.tsx    GameInviteCard.tsx   ChatLevelRing.tsx
  games/                unchanged except useGameSync's transport
```

Every component below the provider takes plain props typed from `lib/chat/types.ts`. None of
them import a chat SDK, because there isn't one.

### Deleted

`lib/stream.ts` · `lib/prompts.ts` (folds into mutations) · `types/stream.d.ts` ·
`types/stream-chat.d.ts` · `app/api/stream-token/` · `app/api/moderate-message/` ·
`app/api/confidence/` · `app/api/chat-prompts/` · `ChatConnectionProvider.tsx` ·
`useChatChannels.ts` ·
`useModeratedSend.ts` · `useChatPresence.ts` · `KindredQuotedMessage.tsx` · `ChannelPill.tsx` ·
`AttachmentMenu.tsx` (becomes a plain menu, ~40 lines, no `AttachmentSelectorAction` registry) ·
63 lines of `.str-chat` overrides in `globals.css` · the `stream-chat` and `stream-chat-react`
dependencies · `NEXT_PUBLIC_STREAM_API_KEY` and `STREAM_SECRET`.

Also going away as a side effect: the `any` casts in `ChatListRow` that coerce
`avatar_id`/`avatarId`/`avatar_seed`/`avatarSeed` four ways, because avatar fields come from
`profiles` joined in a query rather than from whatever was last upserted into a Stream user.

### Feature parity checklist

Everything Stream does for us today, and where it lands:

- [x] Conversation list, DMs + groups in one list, sorted by recency — `listConversations`
- [x] Active / Pending tabs — `conversations.requested_of`
- [x] Wave from Meet, dedupe on repeat waves — `dm_key` unique index
- [x] Reply-accepts-the-wave — inside `sendMessage`, one statement instead of a form POST
- [x] Groups + rename — `conversations.title`
- [x] Unread counts — `last_read_at` vs `messages.created_at`
- [x] Message list with pagination — cursor on `(conversation_id, created_at)`
- [x] Quoted messages — `reply_to_id`
- [x] Soft-deleted messages — `deleted_at`
- [x] Icebreaker prompts, hidden answers, answered-count — `kind` + `prompt_id`
- [x] Kindred bot — `sender_id IS NULL`
- [x] Game invites, join, moves — `game_sessions` + Broadcast
- [x] Chat XP, level ring, daily bonus, tier-ups — unchanged logic, Postgres reads instead of Stream
- [x] Moderation warnings + cooldowns — moved server-side into `sendMessage`
- [x] Cross-tab new-message and wave toasts — shell subscription
- [x] "Active now" — Presence
- [x] Typing indicators — already live (`ChannelPill`), moves to Broadcast
- [ ] Attachments — deliberately out of scope for v1

### The part that is genuinely a rebuild, not a remap

`ChatMessage` in `ChatClient.tsx` falls through to Stream's default `MessageUI` for ordinary
messages, and `<Thread />` is mounted. So users have a hover action bar today that nothing in
this repo asked for and nothing would inherit automatically. All of it is in scope:

| Free from `MessageUI` today | To rebuild | Size |
| --- | --- | --- |
| Emoji reactions | `message_reactions` + hover picker + realtime | ~150 lines |
| Threaded replies | `parent_id`, a thread pane, per-thread reply counts | ~300 lines |
| Edit a message | `edited_at` + inline editor | ~60 lines |
| Delete a message | `deleted_at` | ~30 lines |
| Pin a message | `pinned_at` + a pinned strip | ~80 lines |
| Offline send queue / reconnect gap | optimistic insert + refetch-since on resubscribe | ~40 lines |

This is where the real cost of leaving Stream sits — not in unread counts or pagination. It
gets its own phase rather than being folded into the parity pass, because it is roughly as
much work as the parity pass itself.

Two decisions worth making while building these rather than after:

- **Threads and the XP rules.** `isGenuineBackAndForth` asks "was the previous message in this
  channel from someone else?". In a thread, "previous message" is ambiguous — the thread's or
  the channel's. Scope it to the thread, and note it where the rule is written.
- **Reactions and moderation.** Emoji bypass the word filter by construction. A fixed palette
  of allowed reactions rather than a free emoji picker keeps that from being a hole, and is
  less work.

---

## 5. Cutover — done early, in phase 2

**Superseded on 2026-07-25.** The original plan kept the old XP totals, which meant building a
`channel_cid` → conversation mapping out of Stream before Stream could be removed, and carrying a
dual-keyed schema until then. The decision changed to starting XP fresh, and that removed the
entire problem: with nothing to carry across, there is nothing to read out of Stream, so the
cutover stopped being a phase-7 dependency.

`20260726000000_rekey_xp_on_conversations` did it instead:

- deleted the XP history — 21 `channel_xp`, 20 `daily_chat_activity`, 13 `prompt_awards`
- re-keyed all three onto `conversation_id`, dropping `channel_cid` entirely
- turned `prompt_awards.prompt_id` from an opaque Stream id into a real foreign key
- **kept every `game_sessions` row.** Games are not XP; they only shared the column. Those 43
  rows are what `hasStartedAGame` / `hasWonAGame` read for the Game Starter and Game Winner
  badges. In-progress games were marked abandoned, since the channel they were played in is
  going away.

No `channel_cid` column survives anywhere. Phase 7 is now only deleting Stream code.

---

## 6. Phases

Stream stays installed, connected, and holding its data through phase 6. Not as a runtime
fallback — there is no flag, so once phase 4 lands the branch shows the new chat and only the
new chat. It stays because **the cutover script in phase 7 has to read channel membership out
of Stream** to remap `channel_cid` onto conversation ids, and that is the only place that
mapping exists. Delete Stream before running it and the XP history is unrecoverable.

Rollback before phase 7 is therefore `git switch main`, not a config change. `main` is
untouched the whole time and its Stream chat keeps working.

Phases 1–3 are purely additive: new tables, new server functions, nothing calls them yet.
Running the app on this branch during those phases gives you today's chat, unchanged.
Phase 4 is the first commit that would ship something half-built if merged early.

| # | Work | Rough size |
| --- | --- | --- |
| 1 | Schema + RLS migration, Prisma models. No behaviour change. | small |
| 2 | `lib/chat/{types,queries,mutations}.ts` + server actions. Moderation and XP move inside `sendMessage`. Testable without any UI. | medium |
| 3 | `ChatRealtimeProvider` + `useMessages`. Verify RLS actually filters and that the browser client's realtime auth picks up the SSR session. | medium |
| 4 | List, timeline, composer, tabs. First point Stream is visibly unused. | large |
| 5 | Kindred parity: icebreakers, XP ring, games, presence, typing, unread, toasts. | large |
| 6 | Message actions: reactions, threads, edit, delete, pin, offline/reconnect handling. | large |
| 7 | Delete Stream (deps, env, CSS, files). The data cutover already happened in phase 2. | small |
| 8 | Rewrite the Chat section of CLAUDE.md, lint, manual QA. | small |

### Verify early, in phase 3

Two things are worth proving before building UI on top of them, because both would be expensive
to discover in phase 5:

1. ~~**RLS genuinely filters realtime.**~~ **Done in phase 1** — `scripts/verify-chat-schema.ts`
   proves it at the database level: a member sees their conversation, messages, and reactions;
   an outsider sees zero of each; and neither can write. It runs as the `authenticated` role
   with an impersonated `request.jwt.claims`, which is the same thing Realtime evaluates.
   What remains for phase 3 is only whether the *socket* carries the right identity.
2. ~~**The browser client's realtime connection is authenticated as the user.**~~ **Answered on
   2026-07-27, in the library rather than in a browser.** The worry was that `@supabase/ssr`'s
   `createBrowserClient` reads the session from cookies while the socket needs that token pushed
   separately, so everything would silently arrive as `anon` and RLS would drop it.

   supabase-js already does it, and reading the installed source settles it without two accounts
   and a browser. `SupabaseClient` constructs its realtime client with an `accessToken` callback
   bound to its own session getter, and realtime-js invokes that callback on every connect and
   rejoin — so a reconnect re-reads the current token rather than replaying a stale one. On top
   of that, `_handleTokenChanged` calls `realtime.setAuth(token)` on `INITIAL_SESSION`,
   `SIGNED_IN`, and `TOKEN_REFRESHED`, which covers both first paint and the refresh that used
   to be the scary part.

   **So calling `supabase.realtime.setAuth()` by hand would be a mistake, not a missing step:**
   a manually set token is preserved across resubscribes and *stops* tracking refreshes, which
   is precisely the bug the call would have been trying to prevent. This is written down in
   CLAUDE.md so nobody "fixes" it later.

   What this does **not** prove is end-to-end delivery — that the policies say what we meant, on
   live data, with two real accounts. `npm run verify:chat` covers the policy logic in SQL, so
   what is left is a smoke test rather than an open risk.

### The grant that was missing

Phase 1's verification turned up something the plan had assumed rather than checked: the
`public` schema had **no ACL at all**, and no table in it had a single grant. `authenticated`
and `anon` could not touch anything.

This had never mattered — every read in this app goes through Prisma, which connects as the
owner, and the Supabase browser client is used only for auth, which talks to GoTrue rather than
PostgREST. It matters for realtime, because a policy is only consulted after a grant has allowed
the table to be touched. The subscription would have delivered nothing, forever, without erroring.

`20260725010000_grant_chat_read_to_authenticated` fixes it as narrowly as possible: `USAGE` on
the schema, `SELECT` on exactly the four chat tables, `authenticated` only, no write grants.
Every other table keeps its current posture.

Worth knowing separately: the pre-existing RLS policies on `profiles`, `genders`, `hobbies`, and
`interests` are dead code for the same reason — no grant sits behind them. Left alone here,
since changing what PostgREST exposes is not this project's call to make in passing.

---

## 7. Branch

`feat/supabase-chat` is branched from `main` at `ccbf12f`, which already contains the merged
chat work from `Chat-Features`. Nothing else is in flight.

## 8. Migration drift found on 2026-07-25, and fixed

Phase 1 could not be applied as written, because the database had five migrations the repo
had never seen — applied straight to Supabase, files never committed, present on no branch:

```
20260723000000_add_back_and_forth_counter
20260723001000_drop_daily_bonus_awards
20260723002000_drop_back_and_forth_counter
20260723003000_retarget_ice_breaker_badge
20260723004000_seed_open_book_game_finisher
```

All five were reconstructed from the live schema so the repo can rebuild the database again.
Three are faithful; the `back_and_forth_counter` pair was added and dropped forty minutes
apart and left no trace, so both files are deliberately **empty** with a comment saying so
rather than an invented `ADD COLUMN`. The pair had no net effect, so empty files rebuild the
right database without pretending to know something nobody does.

**`drop_daily_bonus_awards` was a live bug, not just drift.** `lib/confidence.ts`'s
`claimDailyBonus` never stopped inserting into that table, and the insert runs inside
`awardConfidenceForMessage`'s transaction — so every XP award that reached the daily bonus
threshold aborted its own transaction and paid out nothing. The `catch` around the insert does
not help; catching an error does not un-abort a Postgres transaction.
`20260724000000_restore_daily_bonus_awards` puts the table back.

**Standing lesson:** run `npx prisma migrate status` before assuming the repo and the database
agree on this project. They have been out of step before.

Also worth knowing: `schema.prisma`'s introspected `auth` models are stale — Supabase has since
added `oauth_*` and `webauthn_*` tables it does not know about. `migrate deploy` never touches
them, but a `migrate dev` would happily generate a migration dropping Supabase's own auth
tables. Another reason that command is off-limits here.
