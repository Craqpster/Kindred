-- Seed the hobbies and interests lookup tables.
--
-- Both were created empty by 20260716220111_normalize_profiles, which means the
-- onboarding multi-select has nothing to offer and profile_hobbies /
-- profile_interests can never receive a row. This is data only — there is no
-- schema change here, so it is hand-written rather than produced by `migrate diff`.
--
-- The dividing line: a hobby is something you DO (you could invite someone to it);
-- an interest is something you're INTO (you could talk about it). Keeping that line
-- crisp matters because matching will treat the two junctions differently.
--
-- ON CONFLICT: "name" is UNIQUE on both tables, so a re-run — or a retry after a
-- partially applied migration — must be a no-op rather than a constraint violation.

INSERT INTO "hobbies" ("name") VALUES
    ('Reading'),
    ('Cooking'),
    ('Baking'),
    ('Gaming'),
    ('Hiking'),
    ('Running'),
    ('Cycling'),
    ('Swimming'),
    ('Yoga'),
    ('Gardening'),
    ('Photography'),
    ('Drawing'),
    ('Painting'),
    ('Writing'),
    ('Playing an instrument'),
    ('Singing'),
    ('Dancing'),
    ('Knitting'),
    ('Woodworking'),
    ('Board games'),
    ('Chess'),
    ('Rock climbing'),
    ('Fishing'),
    ('Volunteering'),
    ('Skateboarding'),
    ('Collecting')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "interests" ("name") VALUES
    ('Music'),
    ('Film'),
    ('Television'),
    ('Books'),
    ('Anime'),
    ('Comics'),
    ('Technology'),
    ('Programming'),
    ('Science'),
    ('Space'),
    ('History'),
    ('Philosophy'),
    ('Psychology'),
    ('Travel'),
    ('Food'),
    ('Fitness'),
    ('Health'),
    ('Mental health'),
    ('Sports'),
    ('Fashion'),
    ('Art'),
    ('Design'),
    ('Nature'),
    ('Animals'),
    ('Cars'),
    ('Business'),
    ('Languages'),
    ('Politics')
ON CONFLICT ("name") DO NOTHING;
