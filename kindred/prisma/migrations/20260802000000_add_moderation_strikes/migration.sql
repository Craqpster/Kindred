-- CreateTable
CREATE TABLE "moderation_state" (
    "profile_id" UUID NOT NULL,
    "flag_timestamps" TIMESTAMPTZ(6)[] NOT NULL,
    "cooldown_until" TIMESTAMPTZ(6),

    CONSTRAINT "moderation_state_pkey" PRIMARY KEY ("profile_id")
);

-- AddForeignKey
ALTER TABLE "moderation_state" ADD CONSTRAINT "moderation_state_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added below (Prisma models neither):

-- RowLevelSecurity: enabled with no policies = deny by default. Only Prisma touches this
-- table, and it connects as the owner and bypasses RLS; anon/authenticated (PostgREST)
-- get nothing. Same posture as channel_xp/connections/profile_hobbies.
ALTER TABLE "moderation_state" ENABLE ROW LEVEL SECURITY;
