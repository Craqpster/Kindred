-- confidence_level is an internal metric, not a user input.
--
-- 20260716220111_normalize_profiles constrained it to 1..5 on the assumption that
-- onboarding would ask the user to self-report a level. It does not: everyone starts
-- at 1 and the number grows as they actually talk to people. A cap of 5 would put a
-- ceiling on that growth, so the upper bound goes.
--
-- The floor stays: levels start at 1, so 0 and below are invalid, and an
-- unconstrained integer column would happily store a negative.
--
-- DEFAULT 1 is already correct and is left alone.
--
-- Prisma cannot model CHECK constraints, so this will not round-trip through `db pull`
-- and prisma/schema.prisma needs no change.

ALTER TABLE "profiles" DROP CONSTRAINT "profiles_confidence_level_range";

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_confidence_level_range"
    CHECK ("confidence_level" >= 1);
