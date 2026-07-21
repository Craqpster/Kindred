-- CreateTable
CREATE TABLE "daily_chat_activity" (
    "channel_cid" TEXT NOT NULL,
    "profile_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "qualifying_messages" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_chat_activity_pkey" PRIMARY KEY ("channel_cid","profile_id","day")
);

-- CreateTable
CREATE TABLE "daily_bonus_awards" (
    "channel_cid" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "xp_awarded" INTEGER NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_bonus_awards_pkey" PRIMARY KEY ("channel_cid","day")
);

-- AddForeignKey
ALTER TABLE "daily_chat_activity" ADD CONSTRAINT "daily_chat_activity_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added below (Prisma models neither):

-- The bonus check asks "has every member of this channel hit the threshold today", which
-- reads by (channel_cid, day) across profiles. The primary key leads with channel_cid but
-- has profile_id in the middle, so it cannot serve that lookup on its own.
CREATE INDEX "daily_chat_activity_channel_cid_day_idx" ON "daily_chat_activity"("channel_cid", "day");

-- RowLevelSecurity: enabled with no policies = deny by default. Only Prisma touches these
-- tables, and it connects as the owner and bypasses RLS; anon/authenticated (PostgREST)
-- get nothing. Same posture as channel_xp/prompt_awards/connections.
ALTER TABLE "daily_chat_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_bonus_awards" ENABLE ROW LEVEL SECURITY;
