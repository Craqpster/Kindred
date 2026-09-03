-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN "invite_message_id" TEXT;

-- CreateIndex
-- Plain unique, not partial: Postgres treats every NULL as distinct, so immediate 1:1
-- starts (which have no invite message, i.e. NULL here) never collide with each other.
-- This is what makes "first join wins" on a game_invite message atomic - two people
-- joining the same invite both try to set THIS SAME value, and only one create() wins.
CREATE UNIQUE INDEX "game_sessions_invite_message_id_key" ON "game_sessions"("invite_message_id");


-- Hand-added below (Prisma models neither):

-- A group chat can now run several games at once - what stays blocked is the SAME pair
-- (regardless of who's player_one vs player_two) running two games in the same channel
-- at the same time. LEAST/GREATEST normalize the pair so it doesn't matter which side
-- is which.
DROP INDEX "game_sessions_one_active_per_channel";

CREATE UNIQUE INDEX "game_sessions_one_active_per_pair"
    ON "game_sessions" (
        "channel_cid",
        LEAST("player_one_id", "player_two_id"),
        GREATEST("player_one_id", "player_two_id")
    )
    WHERE ("status" = 'in_progress');
