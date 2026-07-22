-- Allow multiple simultaneous games between the same pair.
-- Keep invite_message_id unique so each invite can only be claimed once.

DROP INDEX IF EXISTS "game_sessions_one_active_per_pair";