-- Drops the last Stream identifier left in the schema.
--
-- conversations.group_id has pointed at the group since 20260725000000_add_chat_tables, so
-- a group's chat is reached by relation rather than by an id string with no foreign key
-- behind it. Nothing has written stream_channel_id since Stream was removed, which made
-- the column permanently NULL — and the group card read it to decide whether the chat was
-- ready, so every grouped user was stuck on "Still setting up this chat". That read now
-- goes through the conversation relation; this drops the column it was reading.
--
-- No data is lost that still means anything: the ids named channels in a Stream app that
-- no longer exists.

ALTER TABLE "groups" DROP COLUMN "stream_channel_id";
