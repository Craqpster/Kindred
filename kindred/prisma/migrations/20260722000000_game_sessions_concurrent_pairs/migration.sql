-- One live game per pair of players per channel.
--
-- Hand-written: this is a PARTIAL unique index over EXPRESSIONS, and Prisma can model
-- neither. LEAST/GREATEST normalise the pair so that (a,b) and (b,a) collide - without
-- them the same two people could start two games by swapping who is player one. The
-- WHERE clause is what makes it "one ACTIVE game": completed and abandoned rows fall out
-- of the index, so a finished game never blocks a rematch.
--
-- Enforced in the database rather than in application code because the race it closes is
-- two players tapping "new game" at the same instant, which no amount of checking-then-
-- inserting can prevent from the app side.
CREATE UNIQUE INDEX "game_sessions_one_active_per_pair"
    ON "game_sessions" (
        "channel_cid",
        LEAST("player_one_id", "player_two_id"),
        GREATEST("player_one_id", "player_two_id")
    )
    WHERE "status" = 'in_progress';
