# Working on Kindred

Not a style guide for its own sake. Everything here is either something that has already gone
wrong on this project, or something that would be expensive to undo.

The examples are real. Naming them beats abstract rules, because the abstract version of each
of these sounded obvious right up until it happened.

---

## 1. Things that are hard to undo

### Never run `prisma migrate dev`

Use `npx prisma migrate deploy`.

`migrate dev` reruns your migration history in a shadow database to detect drift, and **prompts
to reset the real one** when it finds any. Prisma's own docs call it a development command that
should never point at a shared database. `migrate deploy` only applies what is pending: it does
not reset, does not detect drift, and warns rather than acts if a migration file changed after
being applied.

This schema is unusually good at triggering that prompt. It covers the introspected Supabase
`auth` schema alongside `public`, and Supabase adds tables there on its own schedule — the
`oauth_*` and `webauthn_*` tables already exist in the database and not in `schema.prisma`. A
schema-diff-based command reads that as drift and offers to "fix" it by dropping Supabase's own
auth tables.

### Always check before you assume the database matches the repo

```bash
npx prisma migrate status
```

On 2026-07-25 this project had **five migrations in the database that existed nowhere in git**.
Someone had applied them straight to Supabase and never committed the files. Two consequences,
both discovered weeks later:

- the repo could no longer rebuild its own database, so a fresh clone produced a different
  schema than production;
- one of them dropped `daily_bonus_awards` while `lib/confidence.ts` was still inserting into
  it. That insert sits inside a transaction, and a failed statement aborts a Postgres
  transaction whether or not the JavaScript `catch` swallows the error — so **every XP award
  that reached the daily bonus threshold had been silently paying out nothing.**

If you change the database, the migration file goes in git in the same breath. A schema change
that only exists in one place is a schema change that only exists until someone else clones.

### Never commit `.env`

`.gitignore` covers `.env*` and lets `.env.example` through, which is the only one that should
ever be committed. When a teammate needs the values, send them privately or point them at the
dashboards — not a gist, not a chat message, not a PR description.

Rotating a leaked database URL is a much worse afternoon than copying a file.

### Branch before editing

Never commit to `main` directly. Branch, push, open a PR — even for a one-line fix, because a
one-line fix is exactly the kind that turns out to touch something else.

---

## 2. Things that make a diff impossible to review

### Don't commit generated files

`lib/generated/` is gitignored. `postinstall` runs `prisma generate`, so a fresh clone has no
Prisma client at all until `npm install` — type errors before that point are expected and mean
nothing.

Committing it would put thousands of machine-written lines into every schema PR and bury the
four lines a human actually needs to read.

*(This entry exists because `docs/setup.md` claimed the opposite for two days. Check
`.gitignore` and `git ls-files` rather than trusting a doc, including this one.)*

### Don't mix a refactor into a feature

If a PR both moves code and changes what it does, a reviewer cannot tell which lines are which,
and neither can `git bisect` six months later. Two commits, or two PRs.

The corollary: **don't refactor code that is scheduled for deletion.** During the Stream
removal, `components/chat/*` had eleven lint errors and every one was left alone, because the
files were deleted a week later. Fixing them would have been throwaway work that made the real
diff harder to read.

### Delete dead code instead of tidying it

Four files in this repo were imported by nothing at all, and one — `InterestHeader.tsx` — was a
**byte-identical copy** of `InterestsEditor.tsx`. Both were being kept in step by hand.

Before deleting someone else's file, check `git log` on it. Recent activity means it may be
half-finished work rather than an oversight, and that is a question to ask rather than a call to
make.

---

## 3. Code

### Names

| Layer | Convention | Example |
| --- | --- | --- |
| Database columns | `snake_case` | `last_message_at`, `conversation_id` |
| TypeScript | `camelCase` | `lastMessageAt`, `conversationId` |
| Types | `PascalCase` | `ChatMessage`, `MessagePage` |
| Booleans | read as a claim | `awaitingYou`, `pending`, not `flag` or `status2` |

The translation between the first two rows happens in exactly one place —
`lib/chat/mapping.ts` — so no component ever holds a database row.

### Never `any`

The repo went from 27 lint errors to zero, and most of them were `any`. It is not a style
preference; it silently disables the thing you are paying TypeScript for.

The clearest case here: `awardConfidenceForMessage(userId, channelCid, ...)` took five
positional strings. Passing a conversation id where a Stream channel id belonged **type-checked
perfectly** and wrote a uuid into the wrong column.

### Named arguments once there are two ids

The fix for the above, and the rule that came out of it. Anything taking two or more ids takes
an object:

```ts
// No.  Both are uuid strings; the wrong order compiles and then denies access forever.
isMember(conversationId, userId)

// Yes.
isMember({ conversationId, userId })
```

`startDm({ senderId, recipientId })` is the sharpest example: swapped, it still succeeds and
still creates a conversation, just with the wave pointing the wrong way. A plausible wrong
answer is worse than a crash.

Branded types were considered and rejected — they need a cast wherever a string enters the
system, and every Prisma read returns `string`, so you would write `as ConversationId` over the
bug without blinking.

### Comments explain *why*

The code already says what it does. A comment earns its place by explaining a decision that is
not visible from the lines around it:

```ts
// Cascades rather than SET NULL on purpose: sender_id being NULL means "the Kindred bot", so
// SET NULL would quietly reattribute a deleted person's messages to the bot.
```

Someone deleting that FK later needs to know that. `// set the sender id` helps nobody.

### One file, one job

Nothing here is over ~300 lines, and the splits followed real seams rather than a line count.
`queries.ts` was deciding *which rows to fetch and who may see them* and *what a row looks like
by the time a component gets it* — two jobs, so two files.

If you cannot describe a file's job in one sentence without "and", that is the seam.

### Design tokens, not literals

Use the palette tokens in `app/globals.css` — `bg-mist`, `text-star-sapphire`, `bg-canvas` —
never raw hex. Fonts are theme tokens: `font-display`, `font-body`. Never `font-[var(--font-x)]`,
which is ambiguous and lets `font-bold` silently override it.

Product constraint that is easy to violate without knowing: **no red, pink, or coral** (reads
romantic — this is explicitly not a dating app) and **no purple** (reads as Discord). Green
carries the growth note.

---

## 4. Security, in this codebase specifically

**Prisma connects as the owner and bypasses row level security.** There is no RLS backstop on
the server. Every query must sit behind a DAL call and be scoped by the authenticated user id
explicitly. An id from the client is only ever used to *narrow* a query that is already
restricted to what the viewer can see.

**RLS exists for exactly one consumer: the browser's realtime socket.** The policies on the chat
tables are read filters for subscribers, not authorization for writes — the browser has `SELECT`
and nothing else.

**Server Actions are reachable by direct POST**, not only through your forms. Every one
re-validates its input with zod and re-derives the user id from the session, never from the
payload.

**A policy is only consulted after a `GRANT`.** This one nearly shipped broken: the `public`
schema had no ACL at all, so `authenticated` could not touch any table. The RLS policies were
therefore unreachable, and the realtime subscription would have delivered **nothing, forever,
without erroring** — the worst possible failure shape. If a subscription is silent, check the
grant before you debug the policy.

---

## 5. What "done" means

```bash
npm run lint          # zero problems, not "only warnings"
npm run build
npm run verify:chat   # 27 checks against the live database
```

`verify:chat` covers what the application cannot see: CHECK constraints rejecting malformed
rows, the `last_message_at` trigger, and RLS actually filtering. It runs as the `authenticated`
role with an impersonated `auth.uid()`, because Prisma connects as the owner and **an owner
bypasses RLS** — a test that queried the way the app does would pass no matter what the policies
said.

Every test runs in a transaction that is rolled back, and the last group asserts the run left
nothing behind.

### Verify, don't assert

The theme running through every incident above. The grant, the phantom migrations, the
byte-identical duplicate, the `any` that wrote to the wrong column, and this document's own
mistake about generated files — every one was found by checking, and none of them looked wrong
from the outside.

When you are about to say "that should be fine", that is the moment to run the command.
