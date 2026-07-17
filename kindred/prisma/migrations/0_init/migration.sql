-- Baseline of the pre-existing Supabase database. Recorded via
-- `prisma migrate resolve --applied 0_init`; it is NOT executed against the live database.
--
-- Hand-edited after `prisma migrate diff`, which reconstructs SQL from the datamodel rather
-- than recording what is actually there:
--   * Removed `CREATE SCHEMA "auth"` and the nine `auth.*` enum types it emitted. Those
--     objects belong to Supabase Auth, which migrates them independently of this project.
--   * Restored `profiles_id_fkey`, which the diff omitted because auth.users introspects as
--     an empty model (the pooler role cannot read auth column metadata).
--   * Added the RLS enable + policies, which Prisma does not model at all.

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "avatar_id" TEXT,
    "confidence_level" INTEGER NOT NULL DEFAULT 1,
    "hobbies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey"
    FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- RowLevelSecurity
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
    ON "profiles" FOR SELECT USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update their own profile"
    ON "profiles" FOR UPDATE USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert their own profile"
    ON "profiles" FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);
