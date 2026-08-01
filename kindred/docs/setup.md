# Setting up on another machine

Everything except the secrets is in the repo. There is no local database to install — Postgres
lives in Supabase, so a second machine points at the same one and sees the same data.

## 1. Get the code

```bash
git clone https://github.com/Craqpster/Kindred.git
cd Kindred/kindred
git checkout feat/supabase-chat
```

The app lives one level below the repo root. Every command below runs from `kindred/`, not
from the clone directory.

## 2. Node

Built on Node 24. Node 20+ should be fine — Next 16 requires 20.9 at minimum — but 24 is what
it is developed against.

```bash
node --version
```

## 3. Secrets

The one thing git cannot give you. `.env` is ignored on purpose, so copy it across yourself:

```bash
cp .env.example .env
```

Then fill in the five values. Two ways to get them:

- **Copy your existing `.env`** from the other machine, through something private. Not email,
  not a chat message, not a gist — these are live database credentials.
- **Re-read them from the dashboards.** Supabase Project Settings gives you the connection
  strings and the API keys; the OpenAI key comes from platform.openai.com. `.env.example`
  says exactly which tab each one is under.

`OPENAI_API_KEY` is the one you can skip if you just want the app running: moderation fails
open by design, so messages go through without it.

## 4. Install

```bash
npm install
```

`postinstall` runs `prisma generate`, so the client is built for you. It writes to
`lib/generated/`, which is **gitignored** — a fresh clone has no Prisma client at all until
`npm install` has run, which is why type errors before that step are expected and mean nothing.

Do step 3 before this one. `prisma generate` itself needs no database, but the CLI loads
`prisma.config.ts` first, and that file warns loudly when `DIRECT_URL` is missing:

```
[prisma.config.ts] DIRECT_URL is not set, so no database command will work.
```

Install still finishes — the warning is not an error — but nothing that talks to Postgres will
run until `.env` exists. On Windows, note that `cp` is `copy .env.example .env` in cmd, and
that `.env` belongs in `kindred/`, next to `package.json`, not at the clone root.

## 5. Check the database agrees with the repo

```bash
npx prisma migrate status
```

This should say everything is applied. If it lists migrations as pending, **stop and read
[chat-rework-plan.md](chat-rework-plan.md) §8** before running anything — this project has been
out of step before, with five migrations applied straight to Supabase and never committed.

> **Never run `prisma migrate dev` on this project.** It compares history against the live
> database and offers to *reset* it when it finds drift, and this schema is prime drift
> territory: it carries the introspected Supabase `auth` schema alongside `public`, and several
> migrations are hand-edited for CHECK constraints and RLS that Prisma cannot model. Use
> `npx prisma migrate deploy`, which only applies what is pending and never resets.

## 6. Run it

```bash
npm run dev
```

## Checking it actually works

```bash
npm run verify:chat
```

24 checks against the live database: the CHECK constraints reject malformed rows, the
`last_message_at` trigger behaves, and RLS shows each person only their own conversations. Every
test runs inside a transaction that is rolled back, so it writes nothing.

`npm run build` and `npm run lint` should both be clean.

## Testing with two accounts

Saying hi writes a `connections` row, and Meet permanently excludes anyone you have one with —
right for real use, exhausting for testing, because two accounts use each other up on the first
wave and can never find each other again.

```bash
npm run reset:connections              # clears every row
npm run reset:connections alex ally    # just that pair, both directions
```

Conversations and messages are untouched; this only forgets who has already been greeted.
