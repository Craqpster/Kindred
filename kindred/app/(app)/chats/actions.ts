"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
    acceptRequest,
    markRead,
    renameGroup,
    sendMessage,
    toggleReaction,
    type SendMessageResult,
    type ToggleReactionResult,
} from "@/lib/chat/mutations";
import { getMessages } from "@/lib/chat/queries";
import { REACTION_EMOJI } from "@/lib/chat/reactions";
import type { MessagePage } from "@/lib/chat/types";
import { verifySession } from "@/lib/dal";

// Thin wrappers over lib/chat. Everything real lives there; these exist to validate input
// and to re-derive who is asking.
//
// Server Actions are reachable by direct POST, not only through our own forms, so nothing
// below trusts the caller for identity: the user id always comes from the session, never
// from the payload. The ids that DO arrive from the client are bounded here and then
// membership-checked inside lib/chat.
//
// z.uuid() is doing real work rather than ceremony. Conversation and message ids are uuids;
// Stream's channel ids never were, and one of the columns these feed is a uuid foreign key -
// so a stale client sending an old Stream id is rejected at the edge with a clear failure
// instead of deep inside Postgres.

const uuid = z.uuid();

const sendInput = z.object({
    conversationId: uuid,
    // Matches the composer's own limit. Long enough not to get in anyone's way, short
    // enough that a scripted caller cannot post an essay.
    body: z.string().trim().min(1).max(4000),
    replyToId: uuid.optional(),
    promptId: uuid.optional(),
    parentId: uuid.optional(),
});

export type SendChatMessageInput = z.infer<typeof sendInput>;

/// Sends a message. Returns the moderation verdict rather than throwing, because a refusal
/// is something the composer has to explain to the user, not an error.
export async function sendChatMessage(
    input: SendChatMessageInput,
): Promise<SendMessageResult | { ok: false; reason: "invalid" }> {
    const { userId } = await verifySession();

    const parsed = sendInput.safeParse(input);
    if (!parsed.success) return { ok: false, reason: "invalid" };

    const result = await sendMessage({ ...parsed.data, senderId: userId });

    // /me renders confidence_points and the tier from a server component, and nothing else
    // invalidates it — without this the profile shows a stale total until the next full load.
    // Only when something was actually awarded, so an ordinary message costs nothing.
    if (result.ok && result.award) revalidatePath("/me");

    return result;
}

/// Accepts an incoming wave without replying to it — the button in the Pending tab.
///
/// Replying accepts it too (see sendMessage), so this is only for accepting outright.
export async function acceptChatRequest(formData: FormData) {
    const { userId } = await verifySession();

    const parsed = uuid.safeParse(formData.get("conversation_id"));
    if (!parsed.success) return;

    await acceptRequest({ conversationId: parsed.data, userId });
    revalidatePath("/chats");
}

// 255 matches the old Stream cap, kept so a rename that used to fit still does. Trimmed and
// non-empty so a name made only of spaces cannot replace a real one.
const renameInput = z.object({
    conversation_id: uuid,
    name: z.string().trim().min(1).max(255),
});

/// Renames a group chat. Any member may do it — renameGroup does the membership check.
///
/// One store now, where this used to write both Stream and Postgres and keep them in step.
export async function renameGroupChat(formData: FormData) {
    const { userId } = await verifySession();

    const parsed = renameInput.safeParse({
        conversation_id: formData.get("conversation_id"),
        name: formData.get("name"),
    });
    if (!parsed.success) return;

    await renameGroup({
        conversationId: parsed.data.conversation_id,
        userId,
        title: parsed.data.name,
    });

    revalidatePath("/chats");
}

/// Clears the unread badge. Called when a conversation is opened and when a message arrives
/// while it is already open.
///
/// Deliberately does not revalidate: the badge is client state fed by realtime, and
/// re-rendering the page to clear a number the client already knows about would be a round
/// trip for nothing.
export async function markConversationRead(conversationId: string) {
    const { userId } = await verifySession();

    const parsed = uuid.safeParse(conversationId);
    if (!parsed.success) return;

    await markRead({ conversationId: parsed.data, userId });
}

// z.enum over the shared allowlist, so an arbitrary emoji — or a megabyte of text in the
// same field — is refused here rather than stored. The column is a free-form String at the
// database level; this is what actually bounds it.
const reactionInput = z.object({ messageId: uuid, emoji: z.enum(REACTION_EMOJI) });

/// Adds or removes one of your reactions on a message.
///
/// Returns the state afterwards so the caller can settle an optimistic toggle, and does not
/// revalidate: reactions reach every other client over realtime, and the acting client
/// already drew the change before this was called.
export async function toggleMessageReaction(
    input: ToggleMessageReactionInput,
): Promise<ToggleReactionResult | { ok: false; reason: "invalid" }> {
    const { userId } = await verifySession();

    const parsed = reactionInput.safeParse(input);
    if (!parsed.success) return { ok: false, reason: "invalid" };

    return toggleReaction({ ...parsed.data, userId });
}

export type ToggleMessageReactionInput = z.infer<typeof reactionInput>;

const olderInput = z.object({ conversationId: uuid, before: z.iso.datetime() });

/// One page further up the timeline. `before` is the createdAt of the oldest message the
/// client is holding.
export async function loadOlderMessages(
    conversationId: string,
    before: string,
): Promise<MessagePage> {
    const { userId } = await verifySession();

    const parsed = olderInput.safeParse({ conversationId, before });
    if (!parsed.success) return { messages: [], nextCursor: null };

    return getMessages({ conversationId: parsed.data.conversationId, userId, before });
}
