# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

All commands run from `kindred/` (the app lives one level below the repo root).

```bash
npm run dev            # next dev
npm run build          # next build
npm run lint           # eslint (flat config, eslint-config-next core-web-vitals + typescript)

npx prisma migrate dev --name <name>   # create + apply a migration
npx prisma generate                    # regenerate client into lib/generated/prisma (also runs postinstall)
npx prisma db pull                     # re-introspect Supabase (incl. the auth schema)

npm run verify:chat        # proves the chat RLS policies actually filter (see below)
npm run reset:connections  # dev-only: clears connections rows so /meet has cards again

npx tsx scripts/seed-dev-profiles.ts           # dev-only: fake profiles so /meet has matches
npx tsx scripts/seed-dev-profiles.ts --clean   # remove them
```

`seed-dev-profiles.ts` is gitignored (it creates real auth users), so it exists only on machines where someone wrote it.

There is no test suite. `npm run verify:chat` is the closest thing: it connects as the `authenticated` role with an impersonated `request.jwt.claims` — the same evaluation Realtime performs — and asserts that a member sees their conversation, messages, and reactions, that an outsider sees none of them, and that neither can write. Run it after touching a chat policy or grant.

**Database connections are split on purpose.** `DATABASE_URL` is Supabase's transaction pooler (6543) and is used by Prisma Client at runtime; `DIRECT_URL` is the session pooler (5432) and is what `prisma.config.ts` hands the CLI. Migrations cannot run through the transaction pooler — it can't hold advisory locks. The Prisma CLI runs outside Next's env loader, so `prisma.config.ts` imports `dotenv/config` explicitly.

## Architecture

Next.js App Router (Next 16, React 19) + Supabase auth + Prisma/Postgres, with chat on our own tables plus Supabase Realtime. Tailwind v4 (CSS-first `@theme`, no tailwind.config).

### Auth and data access

Three layers, and the ordering matters:

1. `proxy.ts` (Next 16's middleware equivalent) runs `updateSession` from [utils/supabase/middleware.ts](utils/supabase/middleware.ts) to refresh the Supabase session cookie on every non-static request.
2. [lib/dal.ts](lib/dal.ts) is the only sanctioned way to read the current user. `verifySession()` requires a session (redirects to `/login`); `getProfile()` requires a session but tolerates no profile (what `/onboarding` needs); `requireProfile()` requires both (redirects to `/onboarding`). All are `cache()`-wrapped, so calling them repeatedly in one render is free.
3. **Prisma connects as `postgres` and bypasses row level security.** There is no RLS backstop — every query must sit behind a DAL call and be scoped by the authenticated user id explicitly. Never trust an id from the client.

Route groups encode the gate: `app/(app)/*` is the authenticated shell, and [app/(app)/layout.tsx](<app/(app)/layout.tsx>) calls `requireProfile()` once for all its tabs. `/login`, `/signup`, `/onboarding` and the landing page live outside that group.

Server Actions (`app/*/actions.ts`) are reachable by direct POST, not just through our forms, so each one re-validates its own input with zod and re-derives the user id from the session rather than the form body.

### Chat (our tables + Supabase Realtime)

Four tables own chat: `conversations`, `conversation_members`, `messages`, `message_reactions`. A DM and a group are the same row shape, distinguished by `kind`.

- **Writes go through [lib/chat/mutations.ts](lib/chat/mutations.ts), never the browser.** This is the point of the rework: moderation, XP, and the membership check all run inside `sendMessage`, so a crafted client cannot skip them. `app/(app)/chats/actions.ts` is thin wrappers that re-derive the user id from the session and bound the ids with zod.
- **Reads for the UI go through Prisma** ([lib/chat/queries.ts](lib/chat/queries.ts)) as the owner role. RLS is not what protects them — the DAL and explicit user-id scoping are.
- **RLS exists for one consumer: the browser's realtime socket**, which connects as `authenticated`. The policies live in `20260725000000_add_chat_tables` and are proven to filter by `npm run verify:chat`, which impersonates the role in SQL. A policy is only consulted after a *grant*, which is why `20260725010000_grant_chat_read_to_authenticated` exists — the `public` schema had no ACL at all, and without it the subscription would have silently delivered nothing forever.
- [components/chat/ChatRealtimeProvider.tsx](components/chat/ChatRealtimeProvider.tsx) holds **one** subscription for the entire authenticated shell, not `/chats`. Unread badges and toasts have to work from `/meet` and `/me`, and subscribing per visit is what made the old implementation racy. Don't move it down.
- The subscription is **unfiltered on purpose**: `postgres_changes` filters allow a single `column=eq.value`, so "messages in any of my conversations" cannot be expressed as one. RLS does that job per subscriber instead.
- **Nothing calls `realtime.setAuth()`, and nothing should.** supabase-js passes an `accessToken` callback into its realtime client and re-pushes on `INITIAL_SESSION` / `TOKEN_REFRESHED`, so the cookie-backed session reaches the socket on connect and after every refresh. Calling it by hand pins a manual token that survives resubscribes and stops tracking refreshes.
- `dm_key` (`least(a,b):greatest(a,b)`, unique) is what makes waving at the same person twice reuse the conversation. `conversations.group_id` (unique) does the same for a group, which is what makes group creation idempotent and retryable.
- The Kindred bot is `messages.sender_id IS NULL`, not a profile row — it has no `auth.users` row to key against, so absence is the marker.

### Meet / matching

[lib/matches.ts](lib/matches.ts) scores candidates in JS: shared hobby/interest names plus a point for a matching `ease_in`, top 10. `connections` rows (one directional row per Meet action) exclude anyone already acted on. This is deliberately naive — swap for a SQL aggregate over the junction tables if the user base grows.

`sayHi` in [app/(app)/meet/actions.ts](<app/(app)/meet/actions.ts>) writes the conversation first and the `connections` row second, so a failure leaves the card retryable rather than hiding someone with no conversation to show for it.

`findMyGroup` in the same file deliberately does the **opposite** — group row first, conversation second. A `group_members` row is a *claim* on people who can each be claimed only once, so it has to be taken atomically before anything observable happens. The window that opens (group committed, conversation missing) is what `FindGroupCard`'s repair state exists for, and `createGroupConversation` is keyed by `group_id` so retrying finishes the job instead of forming a second group.

### Message moderation

[lib/chat/moderation.ts](lib/chat/moderation.ts) is two layers: [lib/word-filter.ts](lib/word-filter.ts) (obscenity, local, free) runs first, then OpenAI's moderation endpoint only for what passes — so the common case never makes a request. **Fails open** — a moderation outage lets messages through rather than breaking chat. [lib/moderation-rate-limit.ts](lib/moderation-rate-limit.ts) is in-memory (resets on restart, not multi-instance safe) and gives 2 warnings before escalating cooldowns.

It runs **inside `sendMessage`, before the row exists**, which is the part that matters. It used to be an advisory API route the browser called before posting to Stream itself, so a client that simply didn't call it was unmoderated. There is no longer a route to skip.

### Database

`prisma/schema.prisma` covers both the `public` and the introspected Supabase `auth` schema; the client generates to `lib/generated/prisma` and is imported as `@/lib/generated/prisma/client` (not `@prisma/client`). That directory is **gitignored** — `postinstall` rebuilds it, so a fresh clone has no client until `npm install` runs. Several invariants are CHECK constraints Prisma cannot model — `ease_in` values, `confidence_level >= 1`, `connections.status` — so they live in the migration SQL and are documented in schema comments. Age is always derived from `birth_date` via [lib/age.ts](lib/age.ts); no age column exists.

Prisma 7's driver adapters dropped `error.meta.target`, so a `P2002` can't tell you which unique index fired — see the onboarding action for the workaround.

## Conventions

- Use the palette tokens in [app/globals.css](app/globals.css) (`bg-mist`, `text-star-sapphire`, `bg-canvas`, `text-accent`, …) rather than literal hexes. The Meet surfaces use a newer warm/green set (`canvas`, `surface`, `slate-ink`, `muted`, `accent`) that sits alongside the original blues instead of replacing them.
- Fonts are theme tokens: `font-display` (Montserrat), `font-body` (Karla), default sans is Poppins. Never `font-[var(--font-x)]` — that form is ambiguous and `font-bold` silently overrides it.
- Recurring design constraint: no red/pink/coral (reads romantic) and no purple (reads as Discord). Green carries the "growth/confidence" note instead. Applies to tag tints and avatars too.
- Non-obvious decisions are documented in comments at the point of the decision. Match that: the existing comments explain *why*, not what.
