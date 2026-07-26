-- Phase 1 of replacing Stream Chat with our own tables + Supabase Realtime.
-- See docs/chat-rework-plan.md.
--
-- Purely additive: nothing reads these tables yet, and the Stream-backed chat keeps
-- working unchanged. The conversation_id columns added to the XP/game tables at the
-- bottom are nullable for exactly that reason - they are filled in later, by
-- scripts/migrate-stream-to-supabase.ts, while Stream is still alive to be read.

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "group_id" UUID,
    "requested_by" UUID,
    "requested_of" UUID,
    "dm_key" TEXT,
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversation_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "last_read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id","profile_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL,
    "reply_to_id" UUID,
    "prompt_id" UUID,
    "parent_id" UUID,
    "game_type" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "edited_at" TIMESTAMPTZ(6),
    "pinned_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "message_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("message_id","profile_id","emoji")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_group_id_key" ON "conversations"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_dm_key_key" ON "conversations"("dm_key");

-- CreateIndex
CREATE INDEX "conversation_members_profile_id_idx" ON "conversation_members"("profile_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_parent_id_created_at_idx" ON "messages"("conversation_id", "parent_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_parent_id_idx" ON "messages"("parent_id");

-- CreateIndex
CREATE INDEX "messages_prompt_id_idx" ON "messages"("prompt_id");

-- CreateIndex
CREATE INDEX "message_reactions_message_id_idx" ON "message_reactions"("message_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_requested_of_fkey" FOREIGN KEY ("requested_of") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added below (Prisma models none of it):

-- CheckConstraint: kind is a closed set, same posture as game_sessions.game_type.
ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_kind_check"
    CHECK ("kind" IN ('dm', 'group'));

-- CheckConstraint: replaces Stream's `messageType` custom field. A new message kind needs
-- its own migration to DROP + re-add this, and a matching entry in lib/chat/types.ts.
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_kind_check"
    CHECK ("kind" IN ('text', 'icebreaker_prompt', 'prompt_response', 'game_invite'));

-- CheckConstraint: the two shapes a conversation can take, spelled out so neither can be
-- half-built. A DM is a member pair and nothing else; a group is titled and points at its
-- groups row. dm_key is what makes waving at the same person twice reuse the conversation
-- (the unique index above is the enforcement) - it replaces Stream's "distinct channel"
-- behaviour, which was implicit in omitting a channel id.
ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_shape_check"
    CHECK (
        ("kind" = 'dm' AND "dm_key" IS NOT NULL AND "group_id" IS NULL)
        OR ("kind" = 'group' AND "dm_key" IS NULL AND "group_id" IS NOT NULL AND "title" IS NOT NULL)
    );

-- CheckConstraint: a wave is both markers or neither. requested_of alone is what the
-- Pending tab filters on, but a row carrying only requested_by would be a request from
-- nobody to nobody, and clearing the pair is how acceptance works.
ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_request_check"
    CHECK (("requested_by" IS NULL) = ("requested_of" IS NULL));

-- CheckConstraint: only a prompt_response names a prompt, and only a game_invite names a
-- game. Without this the columns are suggestions, and the card components would each have
-- to re-check what the schema could have guaranteed.
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_kind_fields_check"
    CHECK (
        ("prompt_id" IS NULL OR "kind" = 'prompt_response')
        AND ("game_type" IS NULL OR "kind" = 'game_invite')
    );

-- CheckConstraint: one level of threading, not a tree. A reply's parent must itself be
-- top-level, which is enforced in lib/chat/mutations.ts rather than here (SQL cannot see
-- the parent row from a CHECK); this only stops a message parenting itself.
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_parent_not_self_check"
    CHECK ("parent_id" IS DISTINCT FROM "id");

-- Keeps conversations.last_message_at current so the chat list sorts and previews without
-- a correlated subquery per row.
--
-- A trigger rather than application code because the UPDATE it performs is ALSO the
-- realtime signal the conversation list reorders on - every path that inserts a message
-- has to emit it, and a trigger is the only way to make that true by construction.
--
-- Thread replies bump it too: a reply is activity in the conversation even though it does
-- not appear in the main timeline.
CREATE FUNCTION "public"."touch_conversation_last_message"() RETURNS TRIGGER
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    UPDATE "public"."conversations"
        SET "last_message_at" = NEW."created_at"
        WHERE "id" = NEW."conversation_id"
          AND ("last_message_at" IS NULL OR "last_message_at" < NEW."created_at");
    RETURN NULL;
END;
$$;

CREATE TRIGGER "messages_touch_conversation"
    AFTER INSERT ON "messages"
    FOR EACH ROW EXECUTE FUNCTION "public"."touch_conversation_last_message"();


-- RowLevelSecurity.
--
-- A deliberate departure from every other table in this schema. Elsewhere RLS is enabled
-- with NO policies - deny by default - because only Prisma touches those tables and it
-- connects as the owner, bypassing RLS entirely. These four are different: Supabase
-- Realtime delivers Postgres changes to the BROWSER client, and it decides what each
-- subscriber may see by evaluating these policies as that user. No policy would mean no
-- realtime at all.
--
-- SELECT only, on purpose. There is no INSERT/UPDATE/DELETE policy on any of these, so
-- the browser client cannot write even if it tries - every write still goes through a
-- server action on Prisma, which bypasses RLS as before. That split is the whole security
-- model: RLS is a read filter for realtime, never an authorization layer for writes.
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_reactions" ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER to break the recursion: a policy ON conversation_members that queries
-- conversation_members would re-enter itself and error. Running as the owner skips the
-- policy on the inner read, which is safe because the function answers exactly one
-- question and takes no user-controlled table or column.
--
-- search_path is pinned empty and every name below fully qualified - a SECURITY DEFINER
-- function that resolves names through the caller's search_path can be pointed at an
-- attacker's table of the same name.
CREATE FUNCTION "public"."is_conversation_member"("conv" UUID) RETURNS BOOLEAN
    LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT 1 FROM "public"."conversation_members"
        WHERE "conversation_id" = "conv" AND "profile_id" = (SELECT auth.uid())
    );
$$;

CREATE POLICY "members read their conversations" ON "conversations"
    FOR SELECT USING ("public"."is_conversation_member"("id"));

CREATE POLICY "members read membership" ON "conversation_members"
    FOR SELECT USING ("public"."is_conversation_member"("conversation_id"));

CREATE POLICY "members read messages" ON "messages"
    FOR SELECT USING ("public"."is_conversation_member"("conversation_id"));

-- Reactions carry no conversation of their own, so membership is reached through the
-- message they sit on.
CREATE POLICY "members read reactions" ON "message_reactions"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."messages"
            WHERE "messages"."id" = "message_reactions"."message_id"
              AND "public"."is_conversation_member"("messages"."conversation_id")
        )
    );

-- Realtime only forwards changes for tables in this publication. Guarded because the
-- publication is created by Supabase rather than by us, so a bare ALTER would fail on a
-- plain Postgres instance (a local `prisma migrate reset`, say) rather than on Supabase.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "pg_publication" WHERE "pubname" = 'supabase_realtime') THEN
        ALTER PUBLICATION "supabase_realtime" ADD TABLE
            "public"."conversations",
            "public"."conversation_members",
            "public"."messages",
            "public"."message_reactions";
    END IF;
END
$$;


-- The XP and game tables are keyed by Stream's channel_cid (e.g. "messaging:!members-abc").
-- Nullable for now: scripts/migrate-stream-to-supabase.ts fills them in during phase 7,
-- while Stream is still installed and can still say which two people a cid belongs to.
-- Migration B then drops channel_cid and makes these NOT NULL.
ALTER TABLE "channel_xp" ADD COLUMN "conversation_id" UUID;
ALTER TABLE "daily_chat_activity" ADD COLUMN "conversation_id" UUID;
ALTER TABLE "daily_bonus_awards" ADD COLUMN "conversation_id" UUID;
ALTER TABLE "game_sessions" ADD COLUMN "conversation_id" UUID;

ALTER TABLE "channel_xp" ADD CONSTRAINT "channel_xp_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_chat_activity" ADD CONSTRAINT "daily_chat_activity_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_bonus_awards" ADD CONSTRAINT "daily_bonus_awards_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "channel_xp_conversation_id_key" ON "channel_xp"("conversation_id");
CREATE INDEX "daily_chat_activity_conversation_id_day_idx" ON "daily_chat_activity"("conversation_id", "day");
CREATE INDEX "game_sessions_conversation_id_idx" ON "game_sessions"("conversation_id");
