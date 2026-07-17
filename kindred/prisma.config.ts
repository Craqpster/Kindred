import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// The CLI runs outside Next's env loader, so `.env` must be loaded explicitly.
// The CLI uses DIRECT_URL (port 5432); the client uses DATABASE_URL (pooled, 6543).
// Migrations must not run through the transaction pooler — it cannot hold advisory locks.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DIRECT_URL") },
});
