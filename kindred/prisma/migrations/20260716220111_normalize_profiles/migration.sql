-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "age",
DROP COLUMN "gender",
DROP COLUMN "hobbies",
DROP COLUMN "interests",
ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "gender_id" SMALLINT,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "genders" (
    "id" SMALLSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "genders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hobbies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "hobbies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_hobbies" (
    "profile_id" UUID NOT NULL,
    "hobby_id" INTEGER NOT NULL,

    CONSTRAINT "profile_hobbies_pkey" PRIMARY KEY ("profile_id","hobby_id")
);

-- CreateTable
CREATE TABLE "profile_interests" (
    "profile_id" UUID NOT NULL,
    "interest_id" INTEGER NOT NULL,

    CONSTRAINT "profile_interests_pkey" PRIMARY KEY ("profile_id","interest_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "genders_code_key" ON "genders"("code");

-- CreateIndex
CREATE UNIQUE INDEX "hobbies_name_key" ON "hobbies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "interests_name_key" ON "interests"("name");

-- CreateIndex
CREATE INDEX "profile_hobbies_hobby_id_idx" ON "profile_hobbies"("hobby_id");

-- CreateIndex
CREATE INDEX "profile_interests_interest_id_idx" ON "profile_interests"("interest_id");

-- CreateIndex
CREATE INDEX "profiles_gender_id_idx" ON "profiles"("gender_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_gender_id_fkey" FOREIGN KEY ("gender_id") REFERENCES "genders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_hobbies" ADD CONSTRAINT "profile_hobbies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_hobbies" ADD CONSTRAINT "profile_hobbies_hobby_id_fkey" FOREIGN KEY ("hobby_id") REFERENCES "hobbies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Everything below is hand-written: Prisma models none of it, so it will not
-- round-trip through `prisma db pull`. Do not expect it to reappear in schema.prisma.
-- ---------------------------------------------------------------------------

-- CheckConstraint: confidence_level was previously unbounded, so -5 or 9999 were storable.
ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_confidence_level_range"
    CHECK ("confidence_level" BETWEEN 1 AND 5);

-- Seed: without rows here, profiles.gender_id can only ever be NULL.
INSERT INTO "genders" ("code", "label") VALUES
    ('woman',             'Woman'),
    ('man',               'Man'),
    ('non_binary',        'Non-binary'),
    ('other',             'Other'),
    ('prefer_not_to_say', 'Prefer not to say');

-- RowLevelSecurity: tables created by a migration arrive with RLS DISABLED.
-- Without this they are readable by anyone holding the anon key.
ALTER TABLE "genders"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hobbies"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interests"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profile_hobbies"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profile_interests" ENABLE ROW LEVEL SECURITY;

-- Lookup tables: readable by any signed-in user, writable by none of them.
CREATE POLICY "Lookup values are readable by authenticated users" ON "genders"
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lookup values are readable by authenticated users" ON "hobbies"
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lookup values are readable by authenticated users" ON "interests"
    FOR SELECT TO authenticated USING (true);

-- The junction tables intentionally have RLS enabled and NO policies.
--
-- RLS with zero policies denies everything to every role except the table owner,
-- which is the state we want: Prisma (connecting as the owning `rafael` role) is the
-- only data path in this app, and it bypasses RLS by ownership. `anon` and
-- `authenticated` reach these tables through PostgREST and get nothing.
--
-- This is also the only state `rafael` can produce. A policy body calling auth.uid()
-- requires USAGE on the auth schema, which `rafael` does not have and `postgres` cannot
-- grant: the auth schema is owned by supabase_auth_admin and postgres is not superuser.
-- The existing profiles policies predate this and were created by postgres.
--
-- If PostgREST/supabase-js access to these tables is ever needed, add the policies and
-- grants from the Supabase SQL Editor (which runs as postgres) — not from a migration.
-- No grants to anon/authenticated for the same reason: tables created by `rafael` do not
-- inherit Supabase's default privileges, and nothing needs them while Prisma is the only reader.
