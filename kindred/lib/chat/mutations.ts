import "server-only";

import { conversationIsBlocked } from "@/lib/blocks";
import { moderate } from "@/lib/chat/moderation";
import { getMessageById, isMember } from "@/lib/chat/queries";
import type { ReactionEmoji } from "@/lib/chat/reactions";
import type { ChatMessage, MessageKind } from "@/lib/chat/types";
import { awardConfidenceForMessage, type AwardResult } from "@/lib/confidence";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Every write the chat can perform.
//
// This is the only way rows reach the chat tables. The browser holds a Supabase client with
// SELECT and nothing else (see 20260725010000_grant_chat_read_to_authenticated), so there is
// no second path that could skip the checks here — which is what lets moderation live inside
// sendMessage instead of in a route the client is trusted to call first.
//
// Prisma bypasses RLS, so every function takes the acting user's id and proves membership
// itself rather than trusting an id from a form.

/// The DM key for a pair: least:greatest, matching the dm_key unique index. The same two
/// people always produce the same string, which is what makes waving twice reuse the
/// conversation instead of opening a second one.
function dmKeyFor(a: string, b: string): string {
    return [a, b].sort().join(":");
}

/// Opens (or reuses) the 1:1 conversation for a wave.
///
/// Deliberately sends no message — the greeting is prefilled into the sender's composer so
/// they send it themselves, exactly as the Stream version worked.
///
/// `mutual` means the recipient already waved, so this is a reply rather than a new request:
/// both people have now reached out, which is precisely the condition the Pending tab is
/// defined by the absence of. The request markers are cleared instead of stamped.
///
/// Returns the conversation id, and whether it had to be created — sayHi only drops an
/// opening icebreaker into a genuinely new conversation, never into a retried wave.
/// Named arguments because sender and recipient are both uuid strings and the order carries
/// the entire meaning: swapped, this still succeeds and still creates a conversation, just
/// with the wave pointing the wrong way. A wrong-but-plausible result is far worse than a
/// failure, so the call site is made to say which is which.
export async function startDm({
    senderId,
    recipientId,
    mutual = false,
}: {
    senderId: string;
    recipientId: string;
    mutual?: boolean;
}): Promise<{ conversationId: string; created: boolean }> {
    const dmKey = dmKeyFor(senderId, recipientId);

    const existing = await prisma.conversations.findUnique({
        where: { dm_key: dmKey },
        select: { id: true },
    });

    if (existing) {
        // A second wave at someone who already waved is the moment it stops being a
        // request. Unsetting both markers is what moves it into Active for both people.
        if (mutual) {
            await prisma.conversations.update({
                where: { id: existing.id },
                data: { requested_by: null, requested_of: null },
            });
        }
        return { conversationId: existing.id, created: false };
    }

    const conversation = await prisma.conversations.create({
        data: {
            kind: "dm",
            dm_key: dmKey,
            // Both markers or neither — conversations_request_check enforces it.
            requested_by: mutual ? null : senderId,
            requested_of: mutual ? null : recipientId,
            members: {
                create: [{ profile_id: senderId }, { profile_id: recipientId }],
            },
        },
        select: { id: true },
    });

    return { conversationId: conversation.id, created: true };
}

/// Opens the conversation for a group formed by lib/groups.ts.
///
/// Keyed by group_id rather than given a fresh id, which makes it idempotent: retrying after
/// a failed run reuses the conversation instead of orphaning one. That is the same reason
/// the Stream version passed the group's uuid as an explicit channel id.
export async function createGroupConversation({
    groupId,
    title,
    memberIds,
}: {
    groupId: string;
    title: string;
    memberIds: string[];
}): Promise<{ conversationId: string; created: boolean }> {
    const existing = await prisma.conversations.findUnique({
        where: { group_id: groupId },
        select: { id: true },
    });

    if (existing) return { conversationId: existing.id, created: false };

    const conversation = await prisma.conversations.create({
        data: {
            kind: "group",
            title,
            group_id: groupId,
            members: { create: memberIds.map((profile_id) => ({ profile_id })) },
        },
        select: { id: true },
    });

    return { conversationId: conversation.id, created: true };
}

export type SendMessageInput = {
    conversationId: string;
    /// null posts as the Kindred bot — only postIcebreaker does that.
    senderId: string | null;
    body: string;
    kind?: MessageKind;
    replyToId?: string;
    promptId?: string;
    parentId?: string;
    gameType?: string;
};

export type SendMessageResult =
    | { ok: true; message: ChatMessage; award: AwardResult | null }
    | { ok: false; reason: "not_a_member" | "empty" | "bad_parent" | "bad_prompt" | "blocked" }
    | { ok: false; reason: "moderated"; cooldownUntil: number | null };

/// Sends a message, and does everything that has to happen around one.
///
/// The order matters and is not arbitrary:
///
///   1. membership, because nothing else should run for someone who is not in the chat;
///   2. moderation, BEFORE the row exists, so a refused message leaves no trace and the
///      pending request it might have accepted stays pending;
///   3. the insert;
///   4. accepting the wave, since replying IS accepting;
///   5. XP, which is bookkeeping and must never be able to fail the send.
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { conversationId, senderId, body } = input;

    // Derived, not taken from the caller. messages_kind_fields_check enforces
    // `prompt_id IS NULL OR kind = 'prompt_response'`, so a prompt_id sent alongside the
    // default kind of 'text' is rejected by Postgres — the send would surface as a crash
    // rather than a refusal. Deriving it means the one thing that sets prompt_id is the same
    // thing that decides the kind, and the constraint cannot be reached from here at all.
    const kind: MessageKind = input.promptId ? "prompt_response" : (input.kind ?? "text");

    const text = body.trim();
    if (!text) return { ok: false, reason: "empty" };

    // A null sender is the bot, which is server-side by construction and has no membership.
    if (senderId && !(await isMember({ conversationId, userId: senderId }))) {
        return { ok: false, reason: "not_a_member" };
    }

    // Blocked either way, so neither person can write into a conversation the other can no
    // longer see. Checked here rather than only in the UI because hiding the conversation from
    // the list does not remove it: the id is still in whoever's history, and a server action is
    // reachable by direct POST.
    //
    // Before moderation on purpose. Moderation costs an API call and can start a cooldown, and
    // a message that was never going to be delivered should not be able to do either.
    if (senderId && (await conversationIsBlocked(conversationId, senderId))) {
        return { ok: false, reason: "blocked" };
    }

    if (senderId) {
        const verdict = await moderate(senderId, text);
        if (!verdict.allowed) {
            return { ok: false, reason: "moderated", cooldownUntil: verdict.cooldownUntil };
        }
    }

    // Threads are one level deep. The CHECK constraint only stops a message parenting
    // itself; that a parent must itself be top-level, and in this same conversation, is not
    // something SQL can see from the row being inserted.
    if (input.parentId) {
        const parent = await prisma.messages.findUnique({
            where: { id: input.parentId },
            select: { conversation_id: true, parent_id: true },
        });

        if (!parent || parent.parent_id !== null || parent.conversation_id !== conversationId) {
            return { ok: false, reason: "bad_parent" };
        }
    }

    // The same treatment as parentId above, and for the same reason: this id comes from the
    // client. The foreign key only proves the message exists somewhere, and the CHECK only
    // ties prompt_id to the kind — neither can see that the prompt belongs to THIS
    // conversation or that it is an icebreaker at all.
    //
    // Unchecked, pointing it at any message id in existence buys the prompt exemption in
    // awardConfidenceForMessage, which pays the larger award and skips the back-and-forth
    // test. prompt_awards and the daily rule bound how often that could be worked, so this
    // was a small cheat rather than an open faucet — but it is a cheat that stops existing
    // for one query.
    if (input.promptId) {
        const prompt = await prisma.messages.findUnique({
            where: { id: input.promptId },
            select: { conversation_id: true, kind: true },
        });

        if (
            !prompt ||
            prompt.conversation_id !== conversationId ||
            prompt.kind !== "icebreaker_prompt"
        ) {
            return { ok: false, reason: "bad_prompt" };
        }
    }

    const created = await prisma.messages.create({
        data: {
            conversation_id: conversationId,
            sender_id: senderId,
            kind,
            body: text,
            reply_to_id: input.replyToId ?? null,
            prompt_id: input.promptId ?? null,
            parent_id: input.parentId ?? null,
            game_type: input.gameType ?? null,
        },
        select: { id: true },
    });

    if (senderId) {
        await acceptWaveOnReply({ conversationId, senderId });
    }

    // Never allowed to throw: by this point the message is already in the conversation, and
    // a bookkeeping failure must not look to the sender like the send failed.
    let award: AwardResult | null = null;
    if (senderId) {
        try {
            award = await awardConfidenceForMessage({
                userId: senderId,
                conversationId,
                messageId: created.id,
                text,
                promptId: input.promptId,
            });
        } catch (error) {
            console.error("XP award failed after a successful send", error);
        }
    }

    const message = await readBack(created.id);
    return { ok: true, message, award };
}

/// Replying to a wave accepts it, which moves the conversation out of Pending for both
/// people. Only the recipient can: for the sender, requested_of names the other person, so
/// this is a no-op on their side and their own wave stays pending until it is answered.
async function acceptWaveOnReply({
    conversationId,
    senderId,
}: {
    conversationId: string;
    senderId: string;
}): Promise<void> {
    // updateMany rather than update: the where clause carries the authorization, so a
    // conversation that is not pending on this person's account simply matches nothing
    // instead of throwing.
    await prisma.conversations.updateMany({
        where: { id: conversationId, requested_of: senderId },
        data: { requested_by: null, requested_of: null },
    });
}

export type EditMessageResult =
    | { ok: true; message: ChatMessage }
    | { ok: false; reason: "not_yours" | "gone" | "empty" }
    | { ok: false; reason: "moderated"; cooldownUntil: number | null };

/// Rewrites a message you sent.
///
/// Re-moderates, and that is not belt and braces — it closes the hole that editing would
/// otherwise open. Moderation runs on the way in, so without this anyone could post something
/// innocuous, let it pass, and then edit it into whatever they liked: the filter would never
/// see the text that ends up on screen.
///
/// No time limit. Most apps stop you editing after a few minutes to keep a conversation
/// honest, which is a fair rule and a product decision rather than a technical one — say so
/// and it is a single comparison against created_at.
export async function editMessage({
    messageId,
    userId,
    body,
}: {
    messageId: string;
    userId: string;
    body: string;
}): Promise<EditMessageResult> {
    const text = body.trim();
    if (!text) return { ok: false, reason: "empty" };

    const existing = await prisma.messages.findUnique({
        where: { id: messageId },
        select: { sender_id: true, deleted_at: true, kind: true },
    });

    if (!existing || existing.deleted_at) return { ok: false, reason: "gone" };

    // Only your own words, and only ordinary ones. An icebreaker belongs to the bot, and a
    // game invite's text is generated — editing either would let the card say one thing while
    // meaning another.
    if (existing.sender_id !== userId || existing.kind !== "text") {
        return { ok: false, reason: "not_yours" };
    }

    const verdict = await moderate(userId, text);
    if (!verdict.allowed) {
        return { ok: false, reason: "moderated", cooldownUntil: verdict.cooldownUntil };
    }

    await prisma.messages.update({
        where: { id: messageId },
        data: { body: text, edited_at: new Date() },
    });

    return { ok: true, message: await readBack(messageId) };
}

/// Takes back a message you sent.
///
/// Soft, so the timeline keeps its slot and a conversation does not silently reshape itself
/// around a hole. toMessage blanks the body on the way out, so the text stops reaching
/// clients even though the row survives.
///
/// XP already awarded is deliberately not clawed back. Unpicking it would mean reversing a
/// daily tally, possibly a level, and possibly a bonus that has already been announced to
/// everyone — a lot of machinery to stop someone gaming a counter that only they see.
export async function deleteMessage({
    messageId,
    userId,
}: {
    messageId: string;
    userId: string;
}): Promise<boolean> {
    // The where clause carries the authorization: someone else's message, or one already
    // deleted, matches nothing rather than throwing.
    const { count } = await prisma.messages.updateMany({
        where: { id: messageId, sender_id: userId, deleted_at: null },
        data: { deleted_at: new Date() },
    });

    return count > 0;
}

/// Marks everything up to now as read for one person.
export async function markRead({
    conversationId,
    userId,
}: {
    conversationId: string;
    userId: string;
}): Promise<void> {
    await prisma.conversation_members.updateMany({
        where: { conversation_id: conversationId, profile_id: userId },
        data: { last_read_at: new Date() },
    });
}

/// Accepts a wave without replying to it — the button in the Pending tab.
///
/// The requested_of match IS the authorization: a conversation that was not waved at this
/// person matches nothing.
export async function acceptRequest({
    conversationId,
    userId,
}: {
    conversationId: string;
    userId: string;
}): Promise<boolean> {
    const { count } = await prisma.conversations.updateMany({
        where: { id: conversationId, requested_of: userId },
        data: { requested_by: null, requested_of: null },
    });

    return count > 0;
}

export type ToggleReactionResult =
    | { ok: true; reacted: boolean }
    | { ok: false; reason: "not_a_member" | "gone" };

/// Adds a reaction, or takes it back if it is already there. One call for both, because the
/// button the user pressed is a toggle and asking the client which direction it meant would
/// let two tabs disagree.
///
/// `reacted` is the state afterwards, not what changed, so a caller that guessed wrong
/// optimistically can settle on the truth without a second read.
export async function toggleReaction({
    messageId,
    userId,
    emoji,
}: {
    messageId: string;
    userId: string;
    emoji: ReactionEmoji;
}): Promise<ToggleReactionResult> {
    // The message is what says which conversation to check, so it has to be read before
    // membership can be. Deleted messages are refused: the timeline keeps their slot, but
    // reacting to something whose text is already gone has nothing to mean.
    const message = await prisma.messages.findUnique({
        where: { id: messageId },
        select: { conversation_id: true, deleted_at: true },
    });

    if (!message || message.deleted_at) return { ok: false, reason: "gone" };

    if (!(await isMember({ conversationId: message.conversation_id, userId }))) {
        return { ok: false, reason: "not_a_member" };
    }

    // Retract first and branch on whether anything went: a read-then-write would let two
    // clicks in flight at once both see "not reacted" and both try to insert.
    //
    // An UPDATE rather than a DELETE, which is the whole point of deleted_at — Realtime
    // forwards the full new row, so the RLS policy can filter a removal the way it already
    // filters an addition. See 20260903000000.
    const { count } = await prisma.message_reactions.updateMany({
        where: { message_id: messageId, profile_id: userId, emoji, deleted_at: null },
        data: { deleted_at: new Date() },
    });

    if (count > 0) return { ok: true, reacted: false };

    // Upsert rather than create: the row may still be there, retracted. The composite
    // primary key is (message_id, profile_id, emoji), so a re-reaction collides with its own
    // soft-deleted row, and clearing deleted_at is what "react again" means. This also
    // absorbs the race the old catch handled — another tab reacting between the update above
    // and here — because the end state is the same either way.
    await prisma.message_reactions.upsert({
        where: {
            message_id_profile_id_emoji: { message_id: messageId, profile_id: userId, emoji },
        },
        create: { message_id: messageId, profile_id: userId, emoji },
        update: { deleted_at: null },
    });

    return { ok: true, reacted: true };
}

/// Renames a group. Any member may do it — membership is the authorization, and the kind
/// check stops it being pointed at a DM, which has no title of its own to change.
export async function renameGroup({
    conversationId,
    userId,
    title,
}: {
    conversationId: string;
    userId: string;
    title: string;
}): Promise<boolean> {
    if (!(await isMember({ conversationId, userId }))) return false;

    const { count } = await prisma.conversations.updateMany({
        where: { id: conversationId, kind: "group" },
        data: { title },
    });

    return count > 0;
}

/// Reads a message back in the exact shape every other surface uses.
///
/// A second query rather than mapping the created row: create() cannot return the sender
/// profile, the quoted message, or the reply count, and handing the client a differently
/// shaped message from the send path than from the timeline is how the two drift apart.
async function readBack(messageId: string): Promise<ChatMessage> {
    const message = await getMessageById(messageId);

    if (!message) {
        // Unreachable: the row was created in this same request.
        throw new Error(`Message ${messageId} vanished immediately after being created`);
    }

    return message;
}
