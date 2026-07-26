-- Puts back the table 20260723001000_drop_daily_bonus_awards removed by mistake.
--
-- lib/confidence.ts never stopped writing to it. claimDailyBonus INSERTs here as its
-- claim on the day's mutual bonus, and that insert runs inside awardConfidenceForMessage's
-- transaction - so with the table missing, every XP award that got as far as the bonus
-- threshold aborted its own transaction and paid out nothing at all. The JS `catch` around
-- the insert does not help: catching the error does not un-abort a Postgres transaction.
--
-- Recreated exactly as 20260721160000_add_daily_chat_xp defined it, including the
-- composite primary key that makes the insert itself the claim - two members finishing at
-- the same instant race for the same row, and exactly one wins.
--
-- The rows that were in it are gone for good. The only cost is that any chat which had
-- already earned its bonus on the day of the drop can earn it once more.

CREATE TABLE "daily_bonus_awards" (
    "channel_cid" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "xp_awarded" INTEGER NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_bonus_awards_pkey" PRIMARY KEY ("channel_cid","day")
);

-- RowLevelSecurity: enabled with no policies = deny by default, matching how this table
-- was originally created and how every other Prisma-only table in this schema is set up.
ALTER TABLE "daily_bonus_awards" ENABLE ROW LEVEL SECURITY;
