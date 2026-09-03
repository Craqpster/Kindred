# Kindred — the app

This directory is the Next.js application. **Every command runs from here**, not from the repo
root.

```bash
cp .env.example .env   # fill in the five values first — see ../README.md
npm install            # postinstall runs `prisma generate`
npx prisma migrate status
npm run dev            # http://localhost:3000
```

Full documentation lives in the [root README](../README.md). The details behind it:

- [`docs/setup.md`](docs/setup.md) — setting up on another machine, step by step
- [`docs/conventions.md`](docs/conventions.md) — working on Kindred, and the incidents behind each rule
- [`docs/chat-rework-plan.md`](docs/chat-rework-plan.md) — the Stream → Supabase Realtime migration
- [`.env.example`](.env.example) — annotated environment variables

One rule worth repeating before you touch the database: **never run `prisma migrate dev` on this
project.** It offers to reset the live database when it detects drift, and this schema — which
covers the introspected Supabase `auth` schema alongside `public` — produces drift every time. Use
`npx prisma migrate deploy`.
