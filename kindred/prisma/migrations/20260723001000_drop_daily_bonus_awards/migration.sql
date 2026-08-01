-- RECONSTRUCTED. This migration was applied directly to the shared Supabase database on
-- 2026-07-23 and its file was never committed, so the repo could not rebuild the database
-- it actually runs against. Reconstructed from the live schema on 2026-07-25.
--
-- The table really is gone from the database - confirmed against information_schema.
--
-- Almost certainly a mistake: lib/confidence.ts's claimDailyBonus still INSERTs into this
-- table, so the daily mutual bonus has been dead since this ran. Worse than dead - the
-- insert sits inside awardConfidenceForMessage's transaction, and a failed statement
-- aborts a Postgres transaction whether or not the JS catch swallows the error, so every
-- XP award that reached the bonus threshold has been failing outright.
--
-- 20260724000000_restore_daily_bonus_awards puts it back.

DROP TABLE IF EXISTS "daily_bonus_awards";
