-- One directional block: `blocker_id` blocked `blocked_id`.
--
-- Directional because the act is, but every read treats it as symmetric: if a row exists in
-- EITHER direction the two people stop seeing each other on Meet, their conversation
-- disappears from both lists, and neither can send. Only the person who blocked can undo it,
-- which is what the direction is actually for.
--
-- Deliberately not a `status` column with 'blocked' in it, the way connections works. A
-- connections row records that something happened and is never removed; a block is a state
-- someone can leave, so unblocking is a DELETE rather than a status change. Keeping them in
-- separate tables also means blocking somebody does not disturb whether Meet has already
-- offered them to you.
--
-- No reason column, and no free text. A block is between two people and nobody adjudicates
-- it, so there is nothing for a reason to be for. Reports are the thing that will want one,
-- and they get their own table when that lands.

-- CreateTable
CREATE TABLE "blocks" (
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateIndex
-- The primary key already covers "who have I blocked". This covers the other direction,
-- "who has blocked me", which every visibility check asks just as often.
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added below (Prisma models neither):

-- CheckConstraint: blocking yourself is not a state worth representing, and a row where both
-- columns match would quietly remove you from your own Meet results and hide every
-- conversation you are in.
ALTER TABLE "blocks"
    ADD CONSTRAINT "blocks_not_self_check"
    CHECK ("blocker_id" <> "blocked_id");

-- RowLevelSecurity: enabled with no policies = deny by default. Only Prisma touches this
-- table, and it connects as the owner and bypasses RLS; anon/authenticated (PostgREST)
-- get nothing. Same posture as connections.
--
-- Worth being explicit about, because the chat tables next door DO grant SELECT to
-- authenticated for the realtime socket: nothing here is ever read by the browser directly.
-- Who has blocked whom is not something a client should be able to enumerate.
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;
