import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma connects as the `postgres` role and BYPASSES row level security.
// Every query must run behind a verified Supabase session — see utils/supabase/server.ts
// and the auth gate in app/api/stream-token/route.ts. Scope queries by the authenticated
// user id explicitly; never trust an id supplied by the client.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
