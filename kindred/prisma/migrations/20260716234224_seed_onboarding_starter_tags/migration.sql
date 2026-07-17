-- Three of the twelve chips on the onboarding "What are you into?" grid do not exist
-- in the lookup tables seeded by 20260716224412_seed_hobbies_interests.
--
-- The grid is one visual row of pills, but the chips come from two tables and are
-- written to two different junctions. Placement follows the same rule as the original
-- seed: a hobby is something you DO, an interest is something you're INTO.
--
-- ON CONFLICT: "name" is UNIQUE on both tables, so a re-run must be a no-op.

INSERT INTO "hobbies" ("name") VALUES
    ('Indie games')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "interests" ("name") VALUES
    ('Live music'),
    ('Coffee')
ON CONFLICT ("name") DO NOTHING;
