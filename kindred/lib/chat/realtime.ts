// Shared between the browser subscription and anything that needs to talk about it.
//
// No server imports: this is loaded by client components.

import type { ChatMember, ChatMessage, MessageKind } from "@/lib/chat/types";

/// The raw `messages` row as Supabase Realtime delivers it — the database's own column
/// names, and every timestamp already a string because the payload is JSON.
///
/// Deliberately NOT the same type as ChatMessage. A realtime payload is one table's row and
/// nothing more: no sender profile, no quoted message, no reply count. Pretending otherwise
/// is how a card ends up rendering "undefined" for a name.
export type MessageRow = {
    id: string;
    conversation_id: string;
    sender_id: string | null;
    kind: string;
    body: string;
    reply_to_id: string | null;
    prompt_id: string | null;
    parent_id: string | null;
    game_type: string | null;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
    pinned_at: string | null;
};

/// Turns a realtime row into the shape the UI already renders.
///
/// The sender is looked up among people the client already has rather than fetched: every
/// message in a conversation comes from one of its members, or from the bot (sender_id
/// null). That turns what would be a round trip per arriving message into a map lookup.
///
/// What genuinely cannot be recovered here is filled in conservatively — a quoted message
/// and a reply count both need a join, so a newly arrived message shows neither until the
/// next full load. For a message that was sent a moment ago, both are almost always empty
/// anyway.
export function messageFromRow(row: MessageRow, membersById: Map<string, ChatMember>): ChatMessage {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        kind: row.kind as MessageKind,
        body: row.deleted_at ? "" : row.body,
        sender: row.sender_id ? (membersById.get(row.sender_id) ?? null) : null,
        replyTo: null,
        promptId: row.prompt_id,
        parentId: row.parent_id,
        replyCount: 0,
        gameType: row.game_type,
        reactions: [],
        createdAt: row.created_at,
        editedAt: row.edited_at,
        deletedAt: row.deleted_at,
        pinnedAt: row.pinned_at,
    };
}

/// Inserts a message in timestamp order, replacing any copy that is already there.
///
/// Both halves matter. Realtime can deliver a message the sender already added from its own
/// send response, so appending blindly shows it twice; and a message that arrives while
/// history is loading can land out of order, so appending to the end is not enough either.
/// Generic over the element so a timeline holding TimelineMessage keeps its `status` in the
/// type as well as at runtime. Returning ChatMessage[] would type-check — status is optional,
/// so the two are assignable — while quietly claiming the field had been dropped.
export function mergeMessage<T extends ChatMessage>(messages: T[], incoming: T): T[] {
    const withoutDuplicate = messages.filter((message) => message.id !== incoming.id);

    const index = withoutDuplicate.findIndex(
        (message) => message.createdAt > incoming.createdAt,
    );

    if (index === -1) return [...withoutDuplicate, incoming];
    return [...withoutDuplicate.slice(0, index), incoming, ...withoutDuplicate.slice(index)];
}
