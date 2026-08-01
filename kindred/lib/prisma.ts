import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma connects as the `postgres` role and BYPASSES row level security.
// Every query must run behind a verified Supabase session — see lib/dal.ts, which is the
// only sanctioned way to read the current user. Scope queries by the authenticated user id
// explicitly; never trust an id supplied by the client.
//
// The chat tables DO carry RLS policies, but those exist for the browser's realtime
// subscription, which connects as `authenticated`. They are not a backstop for anything
// on this connection.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
