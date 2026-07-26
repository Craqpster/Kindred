import "server-only";

import type { ChatMember, ChatMessage, MessageKind } from "@/lib/chat/types";

// Turning database rows into the shapes the UI renders.
//
// Split out from queries.ts because it answers a different question. That file decides WHICH
// rows to fetch and who is allowed to see them; this one decides what a row looks like by the
// time a component gets it. Keeping them together meant every change to a select clause sat
// next to every change to a bubble's contents.
//
// The selects live here too, next to the types that consume them: a column added to one
// without the other is the whole class of bug this arrangement prevents.

/// The profile columns any chat surface needs. Selected explicitly rather than pulling the
/// whole row, so a column added to profiles later cannot quietly start reaching the client.
export const MEMBER_SELECT = {
    id: true,
    username: true,
    avatar_id: true,
    avatar_seed: true,
} as const;

export type MemberRow = {
    id: string;
    username: string;
    avatar_id: string | null;
    avatar_seed: string | null;
};

export function toMember(row: MemberRow): ChatMember {
    return {
        id: row.id,
        username: row.username,
        avatarId: row.avatar_id,
        avatarSeed: row.avatar_seed,
    };
}

/// Everything a message card needs, in one include. Shared by the timeline, the thread view,
/// and the single-message read that sendMessage returns, so all three produce identical
/// shapes and the realtime layer only has one thing to patch.
export const MESSAGE_INCLUDE = {
    sender: { select: MEMBER_SELECT },
    reply_to: {
        select: {
            id: true,
            body: true,
            deleted_at: true,
            sender: { select: { username: true } },
        },
    },
    reactions: { select: { emoji: true, profile_id: true } },
    _count: { select: { thread: true } },
} as const;

export type MessageRow = {
    id: string;
    conversation_id: string;
    kind: string;
    body: string;
    prompt_id: string | null;
    parent_id: string | null;
    game_type: string | null;
    created_at: Date;
    edited_at: Date | null;
    deleted_at: Date | null;
    pinned_at: Date | null;
    sender: MemberRow | null;
    reply_to: {
        id: string;
        body: string;
        deleted_at: Date | null;
        sender: { username: string } | null;
    } | null;
    reactions: { emoji: string; profile_id: string }[];
    _count: { thread: number };
};

export function toMessage(row: MessageRow): ChatMessage {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        kind: row.kind as MessageKind,
        // A deleted message keeps its slot in the timeline but gives up its text — the client
        // is never handed content it is not allowed to draw.
        body: row.deleted_at ? "" : row.body,
        sender: row.sender ? toMember(row.sender) : null,
        replyTo:
            row.reply_to && !row.reply_to.deleted_at
                ? {
                      id: row.reply_to.id,
                      body: row.reply_to.body,
                      senderName: row.reply_to.sender?.username ?? null,
                  }
                : null,
        promptId: row.prompt_id,
        parentId: row.parent_id,
        replyCount: row._count.thread,
        gameType: row.game_type,
        reactions: groupReactions(row.reactions),
        createdAt: row.created_at.toISOString(),
        editedAt: row.edited_at?.toISOString() ?? null,
        deletedAt: row.deleted_at?.toISOString() ?? null,
        pinnedAt: row.pinned_at?.toISOString() ?? null,
    };
}

/// Grouped here rather than in the component: every surface that shows a message wants
/// "👍 3", and tallying a flat list on each render is work done once per card instead of
/// once per query.
function groupReactions(rows: { emoji: string; profile_id: string }[]) {
    const byEmoji = new Map<string, string[]>();

    for (const reaction of rows) {
        const existing = byEmoji.get(reaction.emoji);
        if (existing) existing.push(reaction.profile_id);
        else byEmoji.set(reaction.emoji, [reaction.profile_id]);
    }

    return [...byEmoji].map(([emoji, reactedBy]) => ({ emoji, reactedBy }));
}

/// What a list row shows instead of the message itself.
export function previewFor(kind: string, body: string, deleted: boolean): string {
    if (deleted) return "Message deleted";
    if (kind === "icebreaker_prompt") return "New icebreaker";
    if (kind === "game_invite") return "Invited you to a game";
    return body;
}
