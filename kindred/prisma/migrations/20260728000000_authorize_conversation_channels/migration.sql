-- Lets members — and only members — join the realtime channel for their conversation.
--
-- Presence ("who has this chat open") and typing indicators are ephemeral: they are worth
-- knowing for a few seconds and worthless afterwards, so they travel over Broadcast and
-- Presence rather than being written to a table. That means a channel per conversation,
-- separate from the one shell subscription that carries Postgres changes.
--
-- Those channels need authorizing, and it is not the same mechanism as everywhere else in
-- this schema. Postgres changes are filtered by RLS on the table being changed; broadcast and
-- presence have no table, so Supabase authorizes them with RLS on `realtime.messages`,
-- checked against the topic the client is asking to join.
--
-- Without this the channel would have to be public, and a public channel named by the
-- conversation id is only as private as the id. Conversation ids appear in URLs
-- (/chats?c=...), so "unguessable" is doing more work there than it should have to.
--
-- SELECT is receiving, INSERT is sending. Both are needed: presence is a send (you announce
-- yourself) followed by receives (everyone else's announcements).

-- Safe because the topic is a client-supplied string and `topic::uuid` throws on anything
-- that is not one. A policy that can raise turns a stranger's malformed join into an error
-- rather than a refusal, so the cast is caught and answered with a plain false.
--
-- SECURITY DEFINER for the same reason is_conversation_member is: it reads
-- conversation_members, which has its own policy, and would otherwise recurse.
CREATE FUNCTION "public"."can_use_conversation_channel"("topic" TEXT) RETURNS BOOLEAN
    LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
DECLARE
    conversation_id UUID;
BEGIN
    BEGIN
        conversation_id := "topic"::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN FALSE;
    END;

    RETURN "public"."is_conversation_member"(conversation_id);
END;
$$;

-- Receiving: other people's presence and typing.
CREATE POLICY "members receive on their conversation channels"
    ON "realtime"."messages"
    FOR SELECT
    TO "authenticated"
    USING ("public"."can_use_conversation_channel"((SELECT "realtime"."topic"())));

-- Sending: announcing yourself, and saying you are typing.
--
-- The extension check keeps this to broadcast and presence. It does not widen to anything
-- else Supabase may route through this table later.
CREATE POLICY "members send on their conversation channels"
    ON "realtime"."messages"
    FOR INSERT
    TO "authenticated"
    WITH CHECK (
        "realtime"."messages"."extension" IN ('broadcast', 'presence')
        AND "public"."can_use_conversation_channel"((SELECT "realtime"."topic"()))
    );
