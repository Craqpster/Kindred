-- Data only, no schema change - companion to 20260720190000_add_badges_and_profile_settings,
-- same pattern as 20260716224412_seed_hobbies_interests. Already applied to the shared
-- dev database directly (not through `prisma migrate`); this documents that change so a
-- fresh environment ends up in the same shape and migration history matches reality.
--
-- ON CONFLICT: "name"/"id" are UNIQUE, so a re-run - or a fresh database that never had
-- the deleted rows to begin with - is a no-op rather than an error.

INSERT INTO "badges" ("id", "name", "description", "icon", "tierRequirement") VALUES
    ('11111111-1111-1111-1111-111111111111', 'Ice Breaker', 'Started your first chat', '🧊', 1),
    ('22222222-2222-2222-2222-222222222222', 'Social Butterfly', 'Reached Tier 2', '🦋', 2),
    ('33333333-3333-3333-3333-333333333333', 'Kindred Spirit', 'Reached Tier 3', '✨', 3)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "hobbies" ("name") VALUES
    ('Journaling'),
    ('Thrifting'),
    ('Pilates'),
    ('Photography'),
    ('DIY crafts')
ON CONFLICT ("name") DO NOTHING;

DELETE FROM "hobbies" WHERE "name" IN ('Weightlifting', 'Makeup artistry');

INSERT INTO "interests" ("name") VALUES
    ('Indie music'),
    ('Mental wellness'),
    ('Skincare')
ON CONFLICT ("name") DO NOTHING;

DELETE FROM "interests" WHERE "name" IN ('UX/UI design', 'AI tools', 'Web development');
