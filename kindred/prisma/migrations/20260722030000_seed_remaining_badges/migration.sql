-- Data only, no schema change - same pattern as 20260722010000_seed_game_badges.
--
-- These six were already referenced by app/api/profile/badges/route.ts's detection
-- logic and app/profile/components/BadgesSection.tsx's unlock-hint dictionary, but - like
-- Game Starter/Game Winner before this - no migration ever created the rows, so none of
-- them could ever actually unlock regardless of what the user did.
--
-- "Early Bird" and "Night Owl" are deliberately NOT included here - dropped from the
-- badge list entirely (route.ts's detection and BadgesSection.tsx's UI both removed in
-- the same change) since they only checked what time it happened to be when the badges
-- endpoint was called, not any real past behavior.
--
-- tierRequirement is NULL for all of these, same reasoning as the game badges: they're
-- activity-based, not tier-based, and NULL is what keeps the PATCH handler's tier-based
-- auto-grant sweep (tierRequirement <= earnedTier) from handing them out to everyone who
-- levels up.
--
-- ON CONFLICT: "id" is UNIQUE, so a re-run is a no-op rather than an error.

INSERT INTO "badges" ("id", "name", "description", "icon", "tierRequirement") VALUES
    ('66666666-6666-6666-6666-666666666666', 'Community Helper', 'Helped in a group chat', '🛠️', NULL),
    ('77777777-7777-7777-7777-777777777777', 'Daily Streak', 'Logged in 3 days in a row', '🔥', NULL),
    ('88888888-8888-8888-8888-888888888888', 'Chat Explorer', 'Visited 5 unique rooms', '🧭', NULL),
    ('99999999-9999-9999-9999-999999999999', 'Emoji Master', 'Sent 50 emoji messages', '😄', NULL),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Conversation Starter', 'Started 10 chats', '💬', NULL),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Friend Maker', 'Made 3 friends', '🌿', NULL)
ON CONFLICT ("id") DO NOTHING;
