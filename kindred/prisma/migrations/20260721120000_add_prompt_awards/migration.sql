-- CreateTable
CREATE TABLE "prompt_awards" (
    "prompt_id" TEXT NOT NULL,
    "profile_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_awards_pkey" PRIMARY KEY ("prompt_id","profile_id")
);

-- AddForeignKey
ALTER TABLE "prompt_awards" ADD CONSTRAINT "prompt_awards_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added below (Prisma models neither):

-- RowLevelSecurity: enabled with no policies = deny by default. Only Prisma touches this
-- table, and it connects as the owner and bypasses RLS; anon/authenticated (PostgREST)
-- get nothing. Same posture as channel_xp/connections/profile_hobbies.
ALTER TABLE "prompt_awards" ENABLE ROW LEVEL SECURITY;
