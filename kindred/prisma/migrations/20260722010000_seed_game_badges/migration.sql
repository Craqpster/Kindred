-- Data only, no schema change - same pattern as 20260720190100_seed_badges_and_update_hobby_tags.
--
-- "Game Starter" and "Game Winner" were already referenced by name in
-- app/profile/components/BadgesSection.tsx's unlock-hint dictionary and checked for by
-- app/api/profile/badges/route.ts, but no migration ever actually created the rows - the
-- lookup silently found nothing and neither badge could ever unlock.
--
-- tierRequirement is NULL, not a number: these are activity badges (lib/games.ts's
-- hasStartedAGame/hasWonAGame), not tier badges. The PATCH handler in badges/route.ts
-- only auto-grants badges where tierRequirement <= earnedTier, and SQL's NULL <= x is
-- never true, so a NULL here is what keeps that sweep from granting these to everyone
-- who reaches any tier at all.
--
-- ON CONFLICT: "id" is UNIQUE, so a re-run is a no-op rather than an error.

INSERT INTO "badges" ("id", "name", "description", "icon", "tierRequirement") VALUES
    ('44444444-4444-4444-4444-444444444444', 'Game Starter', 'Started a game', '🎲', NULL),
    ('55555555-5555-5555-5555-555555555555', 'Game Winner', 'Won a game', '🏆', NULL)
ON CONFLICT ("id") DO NOTHING;
