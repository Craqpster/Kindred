-- Dicebear renders the same picture every time for a given style+seed. avatar_id alone
-- (the style) only ever produces one look per style, since the seed was hardcoded to
-- username - this column lets a user "shuffle" to a different-looking avatar within
-- their chosen style. Nullable: falls back to username when unset (ProfileHeader.tsx).

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "avatar_seed" TEXT;
