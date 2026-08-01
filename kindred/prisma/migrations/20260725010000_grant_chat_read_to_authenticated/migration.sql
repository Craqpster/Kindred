-- Lets the browser role actually reach the chat tables, so Supabase Realtime can deliver
-- Postgres changes to it.
--
-- Found by scripts/verify-chat-schema.ts: the `public` schema had NO acl entry at all, and
-- no table in it had a single grant. `authenticated` could not so much as look at the
-- schema. That had never mattered, because everything in this app reads through Prisma -
-- which connects as the owner - and the Supabase browser client is only used for auth,
-- which talks to GoTrue rather than to PostgREST.
--
-- It matters now. Realtime decides what a subscriber may see by checking access AS THAT
-- USER, and an RLS policy is only consulted after a GRANT has already allowed the table to
-- be touched. Policies with no grant behind them are unreachable: the subscription would
-- simply deliver nothing, forever, without erroring.
--
-- Deliberately minimal, because a grant here is a real widening of what PostgREST exposes:
--
--   * SELECT only. There is no INSERT/UPDATE/DELETE grant and no write policy, so the
--     browser still cannot write - every write goes through a server action on Prisma.
--   * Only the four chat tables. Every other table in public keeps its current posture of
--     no grants at all, including profiles and the lookup tables.
--   * `authenticated` only, never `anon`. A signed-out visitor gains nothing.
--
-- Each of these four has RLS enabled with a member-only SELECT policy (see
-- 20260725000000_add_chat_tables), so the grant widens what the role may attempt, and the
-- policy is what decides which rows it actually gets.

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT SELECT ON TABLE "public"."conversations" TO "authenticated";
GRANT SELECT ON TABLE "public"."conversation_members" TO "authenticated";
GRANT SELECT ON TABLE "public"."messages" TO "authenticated";
GRANT SELECT ON TABLE "public"."message_reactions" TO "authenticated";
