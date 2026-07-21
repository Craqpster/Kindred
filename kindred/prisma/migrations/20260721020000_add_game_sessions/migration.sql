-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel_cid" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "player_one_id" UUID NOT NULL,
    "player_two_id" UUID NOT NULL,
    "state" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_sessions_channel_cid_idx" ON "game_sessions"("channel_cid");

-- CreateIndex
CREATE INDEX "game_sessions_player_two_id_idx" ON "game_sessions"("player_two_id");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_player_one_id_fkey" FOREIGN KEY ("player_one_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_player_two_id_fkey" FOREIGN KEY ("player_two_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added below (Prisma models neither):

-- CheckConstraint: game_type is a closed set. A future third game needs its own
-- migration to DROP + re-add this with the new value included.
ALTER TABLE "game_sessions"
    ADD CONSTRAINT "game_sessions_game_type_check"
    CHECK ("game_type" IN ('tic-tac-toe', 'connect-four'));

-- CheckConstraint: status is a closed set.
ALTER TABLE "game_sessions"
    ADD CONSTRAINT "game_sessions_status_check"
    CHECK ("status" IN ('in_progress', 'completed', 'abandoned'));

-- Only one active game per channel at a time, enforced at the DB level.
CREATE UNIQUE INDEX "game_sessions_one_active_per_channel"
    ON "game_sessions" ("channel_cid") WHERE ("status" = 'in_progress');

-- RowLevelSecurity: enabled with no policies = deny by default. Only Prisma touches this
-- table, and it connects as the owner and bypasses RLS; anon/authenticated (PostgREST)
-- get nothing. Same posture as the connections table.
ALTER TABLE "game_sessions" ENABLE ROW LEVEL SECURITY;
