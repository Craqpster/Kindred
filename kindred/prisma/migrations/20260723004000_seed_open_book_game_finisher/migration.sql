-- RECONSTRUCTED from the live database on 2026-07-25 - see
-- 20260723001000_drop_daily_bonus_awards for why these five migrations had no files.
--
-- Data only, no schema change - same pattern as 20260722010000_seed_game_badges.
--
-- "Open Book" picks up the behaviour 20260723003000 just took away from Ice Breaker:
-- answering an icebreaker is now its own recognition rather than a second meaning
-- stapled onto the first-message badge.
--
-- tierRequirement NULL on both, same reasoning as every other activity badge.
--
-- ON CONFLICT: "id" is UNIQUE, so a re-run is a no-op rather than an error.

INSERT INTO "badges" ("id", "name", "description", "icon", "tierRequirement") VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Open Book', 'Answered an icebreaker', '📖', NULL),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Game Finisher', 'Finished a game', '🎮', NULL)
ON CONFLICT ("id") DO NOTHING;
