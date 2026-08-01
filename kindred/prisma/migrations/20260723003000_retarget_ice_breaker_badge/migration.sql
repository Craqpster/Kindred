-- RECONSTRUCTED from the live database on 2026-07-25 - see
-- 20260723001000_drop_daily_bonus_awards for why these five migrations had no files.
--
-- Data only, no schema change.
--
-- "Ice Breaker" was seeded by 20260720190100 as a TIER badge: 'Started your first chat'
-- with tierRequirement 1. Every profile starts at confidence_level 1, so the tier-based
-- auto-grant sweep in app/api/profile/badges/route.ts handed it to everyone the moment
-- they existed - it recognised nothing.
--
-- Retargeting it to an activity badge is what makes it mean something. tierRequirement
-- becomes NULL for the same reason the game badges use NULL: SQL's `NULL <= x` is never
-- true, which is precisely what keeps the tier sweep from granting it.

UPDATE "badges"
    SET "description" = 'Said hi — sent your first message',
        "tierRequirement" = NULL
    WHERE "id" = '11111111-1111-1111-1111-111111111111';
