-- Re-keys the XP and game tables from Stream's channel_cid onto conversation_id.
--
-- DESTRUCTIVE, deliberately: the decision was to start XP fresh rather than map the old
-- Stream totals across. That drops 21 channel_xp rows (the largest holding 30 XP), 20
-- daily_chat_activity rows, and 13 prompt_awards. Nobody loses a badge over it —
-- profile_badges rows are granted once and never revoked.
--
-- This replaces the phase 7 backfill described in docs/chat-rework-plan.md, which existed
-- only to carry those totals over. With them gone there is nothing to read out of Stream,
-- so the cutover no longer has to happen before Stream is removed.
--
-- game_sessions are NOT dropped. They are not XP; they only shared the channel_cid column,
-- and lib/games.ts reads them for the Game Starter and Game Winner badges. The 43 rows stay
-- and simply lose their dead channel reference.

-- The XP history itself. Deleted before the columns move so the re-key is not trying to
-- rewrite rows that are on their way out anyway.
DELETE FROM "daily_bonus_awards";
DELETE FROM "daily_chat_activity";
DELETE FROM "channel_xp";

-- prompt_awards keys on a Stream message id, and those messages are not being imported, so
-- every row here points at something that no longer exists. Emptying it costs nothing: the
-- table exists to stop a prompt paying out twice, and no prompt has been posted yet in the
-- new system.
DELETE FROM "prompt_awards";


-- channel_xp: one row per conversation.
DROP INDEX IF EXISTS "channel_xp_conversation_id_key";
ALTER TABLE "channel_xp" DROP CONSTRAINT "channel_xp_pkey";
ALTER TABLE "channel_xp" DROP COLUMN "channel_cid";
ALTER TABLE "channel_xp" ALTER COLUMN "conversation_id" SET NOT NULL;
ALTER TABLE "channel_xp" ADD CONSTRAINT "channel_xp_pkey" PRIMARY KEY ("conversation_id");


-- daily_chat_activity: one row per person per conversation per UTC day.
ALTER TABLE "daily_chat_activity" DROP CONSTRAINT "daily_chat_activity_pkey";
DROP INDEX IF EXISTS "daily_chat_activity_channel_cid_day_idx";
ALTER TABLE "daily_chat_activity" DROP COLUMN "channel_cid";
ALTER TABLE "daily_chat_activity" ALTER COLUMN "conversation_id" SET NOT NULL;
ALTER TABLE "daily_chat_activity"
    ADD CONSTRAINT "daily_chat_activity_pkey" PRIMARY KEY ("conversation_id", "profile_id", "day");


-- daily_bonus_awards: the insert is still the claim, now keyed by conversation.
ALTER TABLE "daily_bonus_awards" DROP CONSTRAINT "daily_bonus_awards_pkey";
ALTER TABLE "daily_bonus_awards" DROP COLUMN "channel_cid";
ALTER TABLE "daily_bonus_awards" ALTER COLUMN "conversation_id" SET NOT NULL;
ALTER TABLE "daily_bonus_awards"
    ADD CONSTRAINT "daily_bonus_awards_pkey" PRIMARY KEY ("conversation_id", "day");


-- prompt_awards: prompt_id becomes a real foreign key instead of an opaque Stream id.
-- Safe as a plain cast because the table was emptied above.
ALTER TABLE "prompt_awards" DROP CONSTRAINT "prompt_awards_pkey";
ALTER TABLE "prompt_awards" ALTER COLUMN "prompt_id" TYPE UUID USING "prompt_id"::uuid;
ALTER TABLE "prompt_awards" ADD CONSTRAINT "prompt_awards_pkey" PRIMARY KEY ("prompt_id", "profile_id");
ALTER TABLE "prompt_awards"
    ADD CONSTRAINT "prompt_awards_prompt_id_fkey"
    FOREIGN KEY ("prompt_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- game_sessions keep their rows and their badges.
--
-- Any game still marked in_progress belongs to a Stream channel that is going away, so
-- there is no surface left to finish it on. Marking them abandoned is what lib/games.ts
-- would have done to them anyway once their inactivity timeout elapsed.
UPDATE "game_sessions" SET "status" = 'abandoned' WHERE "status" = 'in_progress';

-- conversation_id stays NULLABLE here, unlike the XP tables above: a game played before the
-- rework genuinely has no conversation to point at, and inventing one would be a lie that
-- the Game Winner badge would then read back as fact.
ALTER TABLE "game_sessions" DROP COLUMN "channel_cid";

-- invite_message_id held a Stream message id. Dropped and re-added as a real foreign key -
-- still unique, which is what makes "first join wins" atomic (two people racing to claim the
-- same invite race to write the same value, and only one can).
ALTER TABLE "game_sessions" DROP COLUMN "invite_message_id";
ALTER TABLE "game_sessions" ADD COLUMN "invite_message_id" UUID;
ALTER TABLE "game_sessions"
    ADD CONSTRAINT "game_sessions_invite_message_id_key" UNIQUE ("invite_message_id");
ALTER TABLE "game_sessions"
    ADD CONSTRAINT "game_sessions_invite_message_id_fkey"
    FOREIGN KEY ("invite_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
