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

npx tsx scripts/seed-dev-profiles.ts           # dev-only: fake profiles so /meet has matches
npx tsx scripts/seed-dev-profiles.ts --clean   # remove them
```

There is no test suite.

**Database connections are split on purpose.** `DATABASE_URL` is Supabase's transaction pooler (6543) and is used by Prisma Client at runtime; `DIRECT_URL` is the session pooler (5432) and is what `prisma.config.ts` hands the CLI. Migrations cannot run through the transaction pooler — it can't hold advisory locks. The Prisma CLI runs outside Next's env loader, so `prisma.config.ts` imports `dotenv/config` explicitly.

## Architecture

Next.js App Router (Next 16, React 19) + Supabase auth + Prisma/Postgres + Stream Chat. Tailwind v4 (CSS-first `@theme`, no tailwind.config).

### Auth and data access

Three layers, and the ordering matters:

1. `proxy.ts` (Next 16's middleware equivalent) runs `updateSession` from [utils/supabase/middleware.ts](utils/supabase/middleware.ts) to refresh the Supabase session cookie on every non-static request.
2. [lib/dal.ts](lib/dal.ts) is the only sanctioned way to read the current user. `verifySession()` requires a session (redirects to `/login`); `getProfile()` requires a session but tolerates no profile (what `/onboarding` needs); `requireProfile()` requires both (redirects to `/onboarding`). All are `cache()`-wrapped, so calling them repeatedly in one render is free.
3. **Prisma connects as `postgres` and bypasses row level security.** There is no RLS backstop — every query must sit behind a DAL call and be scoped by the authenticated user id explicitly. Never trust an id from the client.

Route groups encode the gate: `app/(app)/*` is the authenticated shell, and [app/(app)/layout.tsx](<app/(app)/layout.tsx>) calls `requireProfile()` once for all its tabs. `/login`, `/signup`, `/onboarding` and the landing page live outside that group.

Server Actions (`app/*/actions.ts`) are reachable by direct POST, not just through our forms, so each one re-validates its own input with zod and re-derives the user id from the session rather than the form body.

### Chat (Stream)

- [components/chat/ChatConnectionProvider.tsx](components/chat/ChatConnectionProvider.tsx) holds the `<Chat>` client and wraps the *entire* authenticated shell, not `/chats`. Connecting per-tab-visit caused "can't use a channel after disconnect()" races and broke cross-tab notifications. Don't move it down.
- [app/api/stream-token/route.ts](app/api/stream-token/route.ts) mints the user token server-side after an auth check. It throws at module scope if the Stream env vars are missing, so the app won't boot without them.
- [lib/stream.ts](lib/stream.ts) `startChatRequest()` creates 1:1 channels *without* an explicit id, which makes Stream treat them as "distinct" per member pair — waving twice reuses the conversation. It returns a channel **id**, not a cid; `customActiveChannel` queries by id and fails at runtime on a cid.

### Meet / matching

[lib/matches.ts](lib/matches.ts) scores candidates in JS: shared hobby/interest names plus a point for a matching `ease_in`, top 10. `connections` rows (one directional row per Meet action) exclude anyone already acted on. This is deliberately naive — swap for a SQL aggregate over the junction tables if the user base grows.

`sayHi` in [app/(app)/meet/actions.ts](<app/(app)/meet/actions.ts>) writes Stream first, Postgres second, so a failure leaves the card retryable rather than hiding someone with no conversation to show for it.

### Message moderation

[app/api/moderate-message/route.ts](app/api/moderate-message/route.ts) is two layers: [lib/word-filter.ts](lib/word-filter.ts) (obscenity, local, free) runs first, then OpenAI's moderation endpoint only for what passes. **Fails open** — a moderation outage lets messages through rather than breaking chat. [lib/moderation-rate-limit.ts](lib/moderation-rate-limit.ts) is in-memory (resets on restart, not multi-instance safe) and gives 2 warnings before escalating cooldowns.

### Database

`prisma/schema.prisma` covers both the `public` and the introspected Supabase `auth` schema; the generated client is committed at `lib/generated/prisma` and imported as `@/lib/generated/prisma/client` (not `@prisma/client`). Several invariants are CHECK constraints Prisma cannot model — `ease_in` values, `confidence_level >= 1`, `connections.status` — so they live in the migration SQL and are documented in schema comments. Age is always derived from `birth_date` via [lib/age.ts](lib/age.ts); no age column exists.

Prisma 7's driver adapters dropped `error.meta.target`, so a `P2002` can't tell you which unique index fired — see the onboarding action for the workaround.

## Conventions

- Use the palette tokens in [app/globals.css](app/globals.css) (`bg-mist`, `text-star-sapphire`, `bg-canvas`, `text-accent`, …) rather than literal hexes. The Meet surfaces use a newer warm/green set (`canvas`, `surface`, `slate-ink`, `muted`, `accent`) that sits alongside the original blues instead of replacing them.
- Fonts are theme tokens: `font-display` (Montserrat), `font-body` (Karla), default sans is Poppins. Never `font-[var(--font-x)]` — that form is ambiguous and `font-bold` silently overrides it.
- Recurring design constraint: no red/pink/coral (reads romantic) and no purple (reads as Discord). Green carries the "growth/confidence" note instead. Applies to tag tints and avatars too.
- Stream's CSS needs overrides on a selector matching its own element (`.str-chat.str-chat__channel-list`), not on a wrapper — it sets custom properties directly on the element.
- Non-obvious decisions are documented in comments at the point of the decision. Match that: the existing comments explain *why*, not what.
