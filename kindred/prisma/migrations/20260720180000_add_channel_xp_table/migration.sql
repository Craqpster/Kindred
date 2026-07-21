-- CreateTable
CREATE TABLE "channel_xp" (
    "channel_cid" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_xp_pkey" PRIMARY KEY ("channel_cid")
);


-- Hand-added below (Prisma models neither):

-- RowLevelSecurity: enabled with no policies = deny by default. Only Prisma touches this
-- table, and it connects as the owner and bypasses RLS; anon/authenticated (PostgREST)
-- get nothing. Same posture as connections/profile_hobbies/profile_interests.
ALTER TABLE "channel_xp" ENABLE ROW LEVEL SECURITY;
