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
/// Folds a realtime row into the timeline, whether it is a new message or a change to one
/// already there.
///
/// The care is in what a row does NOT carry. Reactions, the quoted message and the reply count
/// all need joins, so messageFromRow leaves them empty — fine for an arrival, wrong for an
/// edit, where blanking them would make somebody's reactions vanish because the author fixed a
/// typo. Anything the timeline already knows is kept; only what the row actually speaks to is
/// replaced.
export function applyRow<T extends ChatMessage>(
    messages: T[],
    row: MessageRow,
    membersById: Map<string, ChatMember>,
    /// Passed in because only the caller knows what its element type carries beyond
    /// ChatMessage — TimelineMessage's `status`, for instance.
    asTimelineMessage: (message: ChatMessage) => T,
): T[] {
    const existing = messages.find((message) => message.id === row.id);
    const incoming = messageFromRow(row, membersById);

    if (!existing) return mergeMessage(messages, asTimelineMessage(incoming));

    return mergeMessage(
        messages,
        asTimelineMessage({
            ...incoming,
            reactions: existing.reactions,
            replyTo: existing.replyTo,
            replyCount: existing.replyCount,
        }),
    );
}

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

/// A `message_reactions` row as realtime delivers it. The primary key is
/// (message_id, profile_id, emoji), and a DELETE payload carries exactly the replica
/// identity — which for this table is that key — so a removal arrives fully described.
export type ReactionRow = {
    message_id: string;
    profile_id: string;
    emoji: string;
};

/// Adds or removes one person's reaction, in whatever state the list is already in.
///
/// Written as "make it so" rather than "apply this change", and that is the point: the same
/// call has to be safe from an optimistic click AND from the realtime echo of that click
/// coming back a moment later, in either order. Toggling would double-apply; this cannot.
///
/// A message that is not in the list is left alone rather than created — a reaction on a
/// message this timeline has not loaded has nothing to attach to, and inventing a slot for
/// it would put an empty bubble on screen.
export function applyReaction<T extends ChatMessage>(
    messages: T[],
    row: ReactionRow,
    present: boolean,
): T[] {
    return messages.map((message) => {
        if (message.id !== row.message_id) return message;

        const existing = message.reactions.find((r) => r.emoji === row.emoji);
        const reactedBy = existing?.reactedBy ?? [];
        const has = reactedBy.includes(row.profile_id);

        if (has === present) return message;

        const nextReactedBy = present
            ? [...reactedBy, row.profile_id]
            : reactedBy.filter((id) => id !== row.profile_id);

        return {
            ...message,
            // An emoji nobody is left holding stops being a pill rather than becoming "0".
            reactions: nextReactedBy.length
                ? existing
                    ? message.reactions.map((r) =>
                          r.emoji === row.emoji ? { ...r, reactedBy: nextReactedBy } : r,
                      )
                    : [...message.reactions, { emoji: row.emoji, reactedBy: nextReactedBy }]
                : message.reactions.filter((r) => r.emoji !== row.emoji),
        };
    });
}
