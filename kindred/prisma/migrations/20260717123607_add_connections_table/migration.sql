-- CreateTable
CREATE TABLE "connections" (
    "user_id" UUID NOT NULL,
    "other_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("user_id","other_id")
);

-- CreateIndex
CREATE INDEX "connections_other_id_idx" ON "connections"("other_id");

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_other_id_fkey" FOREIGN KEY ("other_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added below (Prisma models neither):

-- CheckConstraint: status is a closed set.
ALTER TABLE "connections"
    ADD CONSTRAINT "connections_status_check"
    CHECK ("status" IN ('dismissed', 'greeted'));

-- RowLevelSecurity: enabled with no policies = deny by default. Only Prisma touches this
-- table, and it connects as the owner and bypasses RLS; anon/authenticated (PostgREST)
-- get nothing. Same posture as the profile_hobbies / profile_interests junctions.
ALTER TABLE "connections" ENABLE ROW LEVEL SECURITY;
