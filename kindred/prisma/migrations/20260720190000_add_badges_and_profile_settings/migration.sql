-- This migration documents schema changes that were already applied directly to the
-- shared dev database (via ad hoc scripts, not `prisma migrate`) as part of the profile
-- page redesign. It is registered with `prisma migrate resolve --applied` rather than
-- run, since the columns/tables already exist. Written so a fresh environment ends up
-- in the same shape.

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "confidence_points" INTEGER DEFAULT 0,
ADD COLUMN     "display_name_mode" TEXT DEFAULT 'username',
ADD COLUMN     "dms_open" BOOLEAN DEFAULT true,
ADD COLUMN     "show_confidence" BOOLEAN DEFAULT true,
ADD COLUMN     "show_interests" BOOLEAN DEFAULT true;

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "tierRequirement" INTEGER,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_badges" (
    "profile_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,

    CONSTRAINT "profile_badges_pkey" PRIMARY KEY ("profile_id","badge_id")
);

-- CreateIndex
CREATE INDEX "profile_badges_badge_id_idx" ON "profile_badges"("badge_id");

-- AddForeignKey
ALTER TABLE "profile_badges" ADD CONSTRAINT "profile_badges_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_badges" ADD CONSTRAINT "profile_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added below (Prisma models neither):

-- RowLevelSecurity: badges is a reference table like hobbies/interests - readable by
-- any signed-in user, writable by none of them.
ALTER TABLE "badges" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lookup values are readable by authenticated users" ON "badges"
    FOR SELECT TO authenticated USING (true);

-- RowLevelSecurity: profile_badges is a junction table like profile_hobbies /
-- profile_interests - RLS enabled with no policies denies everything except the table
-- owner (Prisma, which bypasses RLS by connecting as that role).
ALTER TABLE "profile_badges" ENABLE ROW LEVEL SECURITY;
