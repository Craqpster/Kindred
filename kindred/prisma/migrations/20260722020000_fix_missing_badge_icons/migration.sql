-- Data only, no schema change. The three original badges (created by an ad hoc script
-- before 20260720190000_add_badges_and_profile_settings documented the table - see that
-- migration's own comment) were inserted with an empty icon. A later seed migration
-- (20260720190100_seed_badges_and_update_hobby_tags) tried to set the real emoji, but
-- used ON CONFLICT ("id") DO NOTHING - since rows with these ids already existed, that
-- insert silently no-op'd and the icons never actually got set.
--
-- UPDATE, not another INSERT ... ON CONFLICT: this fixes the rows that are already
-- there instead of trying (and failing the same way again) to insert new ones.
-- Scoped by "id" to exactly the three known rows - nothing else in this table is
-- touched, and no rows are added or removed.

UPDATE "badges" SET "icon" = '🧊' WHERE "id" = '11111111-1111-1111-1111-111111111111';
UPDATE "badges" SET "icon" = '🦋' WHERE "id" = '22222222-2222-2222-2222-222222222222';
UPDATE "badges" SET "icon" = '✨' WHERE "id" = '33333333-3333-3333-3333-333333333333';
