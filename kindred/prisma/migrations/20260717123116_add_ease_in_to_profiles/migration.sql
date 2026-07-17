-- Store the onboarding "how do you want to ease in?" answer.
--
-- Until now this was collected in the wizard but thrown away — purely UX gating. The
-- Meet tab uses it in "why you matched" (two people who both want a hand starting
-- conversations have that in common), so it needs to persist.
--
-- Nullable: existing rows have none, and a direct POST that omits it should not fail.
-- The wizard's step-5 gate means every real signup sets one of the three values.
-- Prisma cannot model the CHECK, so this will not round-trip through `db pull`.

ALTER TABLE "profiles" ADD COLUMN "ease_in" TEXT;

ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_ease_in_check"
    CHECK ("ease_in" IN ('openers', 'gradual', 'volume'));
