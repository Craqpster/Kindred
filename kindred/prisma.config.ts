import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// The CLI runs outside Next's env loader, so `.env` must be loaded explicitly.
// The CLI uses DIRECT_URL (port 5432); the client uses DATABASE_URL (pooled, 6543).
// Migrations must not run through the transaction pooler — it cannot hold advisory locks.

// `env()` throws while the config file is still loading, before the CLI knows which command
// it was asked to run. That made a missing DIRECT_URL fail `npm install` outright, via the
// postinstall `prisma generate` — which reads the schema and touches no database at all.
// Resolve it ourselves instead and leave the datasource off when it is absent, so generate
// still works on a fresh clone and only the commands that really need a connection stop.
const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  console.warn(
    "[prisma.config.ts] DIRECT_URL is not set, so no database command will work.\n" +
      "  Copy kindred/.env.example to kindred/.env and fill it in — see docs/setup.md §3.\n" +
      "  DIRECT_URL is Supabase's *session* pooler string (port 5432), not the transaction\n" +
      "  pooler on 6543 that DATABASE_URL uses.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(directUrl ? { datasource: { url: env("DIRECT_URL") } } : {}),
});
