import "server-only";

import { prisma } from "@/lib/prisma";
import type {
    ChatConversation,
    ChatMember,
    ChatMessage,
    ConversationKind,
    MessageKind,
    MessagePage,
} from "@/lib/chat/types";

// Reads for every chat surface.
//
// Prisma connects as the owner and bypasses row level security, so nothing here is
// protected by the policies added in 20260725000000_add_chat_tables — those exist for the
// browser's realtime subscription, not for this file. Every function below therefore takes
// the viewer's id and scopes by membership itself. An id arriving from the client is only
// ever used to narrow a query that is already restricted to conversations the viewer is in.

/// How many messages a page of history holds.
const PAGE_SIZE = 30;

/// The profile columns any chat surface needs. Selected explicitly rather than pulling the
/// whole row, so a column added to profiles later cannot quietly start reaching the client.
const MEMBER_SELECT = {
    id: true,
    username: true,
    avatar_id: true,
    avatar_seed: true,
} as const;

type MemberRow = { id: string; username: string; avatar_id: string | null; avatar_seed: string | null };

function toMember(row: MemberRow): ChatMember {
    return {
        id: row.id,
        username: row.username,
        avatarId: row.avatar_id,
        avatarSeed: row.avatar_seed,
    };
}

/// Everything a message card needs, in one include. Shared by the timeline, the thread
/// view, and the single-message read that sendMessage returns, so all three produce
/// identical shapes and the realtime layer only has one thing to patch.
const MESSAGE_INCLUDE = {
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

type MessageRow = {
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
    reply_to: { id: string; body: string; deleted_at: Date | null; sender: { username: string } | null } | null;
    reactions: { emoji: string; profile_id: string }[];
    _count: { thread: number };
};

function toMessage(row: MessageRow): ChatMessage {
    // Grouped here rather than in the component: every surface that shows a message wants
    // "👍 3", and tallying a flat list on each render is work done once per card instead of
    // once per query.
    const byEmoji = new Map<string, string[]>();
    for (const reaction of row.reactions) {
        const existing = byEmoji.get(reaction.emoji);
        if (existing) existing.push(reaction.profile_id);
        else byEmoji.set(reaction.emoji, [reaction.profile_id]);
    }

    return {
        id: row.id,
        conversationId: row.conversation_id,
        kind: row.kind as MessageKind,
        // A deleted message keeps its slot in the timeline but gives up its text — the
        // client is never handed content it is not allowed to draw.
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
        reactions: [...byEmoji].map(([emoji, reactedBy]) => ({ emoji, reactedBy })),
        createdAt: row.created_at.toISOString(),
        editedAt: row.edited_at?.toISOString() ?? null,
        deletedAt: row.deleted_at?.toISOString() ?? null,
        pinnedAt: row.pinned_at?.toISOString() ?? null,
    };
}

/// What a list row shows instead of the message itself.
function previewFor(kind: string, body: string, deleted: boolean): string {
    if (deleted) return "Message deleted";
    if (kind === "icebreaker_prompt") return "New icebreaker";
    if (kind === "game_invite") return "Invited you to a game";
    return body;
}

/// Every conversation this person is in, newest activity first.
///
/// Three queries rather than one: the conversations with their members, then unread counts,
/// then previews. The last two are raw SQL because neither is expressible in Prisma without
/// a query per conversation — unread compares each message against a cutoff that differs per
/// row, and "the newest message in each conversation" is a DISTINCT ON.
export async function listConversations(userId: string): Promise<ChatConversation[]> {
    const memberships = await prisma.conversation_members.findMany({
        where: { profile_id: userId },
        select: {
            conversation: {
                select: {
                    id: true,
                    kind: true,
                    title: true,
                    requested_by: true,
                    requested_of: true,
                    last_message_at: true,
                    members: {
                        select: { profile: { select: MEMBER_SELECT } },
                        orderBy: { joined_at: "asc" },
                    },
                },
            },
        },
    });

    if (memberships.length === 0) return [];

    const conversationIds = memberships.map((row) => row.conversation.id);
    const [unread, previews] = await Promise.all([
        unreadCounts(userId, conversationIds),
        latestMessages(conversationIds),
    ]);

    const conversations = memberships.map(({ conversation }) => {
        const others = conversation.members
            .map((member) => member.profile)
            .filter((profile) => profile.id !== userId)
            .map(toMember);

        const latest = previews.get(conversation.id);

        return {
            id: conversation.id,
            kind: conversation.kind as ConversationKind,
            // A DM has no title of its own — it is named after whoever else is in it, which
            // means the same row reads differently to each participant.
            title: conversation.title ?? others[0]?.username ?? "Conversation",
            others,
            lastMessageAt: conversation.last_message_at?.toISOString() ?? null,
            preview: latest ? previewFor(latest.kind, latest.body, latest.deleted) : null,
            unreadCount: unread.get(conversation.id) ?? 0,
            pending: conversation.requested_of !== null,
            awaitingYou: conversation.requested_of === userId,
        };
    });

    // Sorted here rather than in SQL because the ordering key lives on the conversation
    // while the query above is anchored on membership. A conversation with no messages yet
    // — a wave — sorts to the top, which is where a brand new request belongs.
    return conversations.sort((a, b) => {
        if (!a.lastMessageAt) return -1;
        if (!b.lastMessageAt) return 1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });
}

/// Unread per conversation: messages newer than this person's last_read_at that they did
/// not send. Thread replies count — an unseen message is unseen wherever it lives.
async function unreadCounts(userId: string, conversationIds: string[]): Promise<Map<string, number>> {
    const rows = await prisma.$queryRaw<{ conversation_id: string; unread: number }[]>`
        SELECT m.conversation_id, count(*)::int AS unread
        FROM messages m
        JOIN conversation_members cm
          ON cm.conversation_id = m.conversation_id AND cm.profile_id = ${userId}::uuid
        WHERE m.conversation_id = ANY(${conversationIds}::uuid[])
          AND m.created_at > cm.last_read_at
          AND m.deleted_at IS NULL
          AND m.sender_id IS DISTINCT FROM ${userId}::uuid
        GROUP BY m.conversation_id;
    `;

    return new Map(rows.map((row) => [row.conversation_id, row.unread]));
}

/// The newest message in each conversation, for the list preview. DISTINCT ON is Postgres's
/// answer to "the first row of each group" and rides the (conversation_id, parent_id,
/// created_at) index rather than sorting the whole table.
async function latestMessages(
    conversationIds: string[],
): Promise<Map<string, { kind: string; body: string; deleted: boolean }>> {
    const rows = await prisma.$queryRaw<
        { conversation_id: string; kind: string; body: string; deleted: boolean }[]
    >`
        SELECT DISTINCT ON (conversation_id)
               conversation_id, kind, body, (deleted_at IS NOT NULL) AS deleted
        FROM messages
        WHERE conversation_id = ANY(${conversationIds}::uuid[])
          AND parent_id IS NULL
        ORDER BY conversation_id, created_at DESC;
    `;

    return new Map(rows.map((row) => [row.conversation_id, row]));
}

/// One conversation, or null if this person is not in it.
///
/// The null is the authorization: every caller has to handle "not yours" and "does not
/// exist" the same way, so neither can be told apart from the outside.
export async function getConversation(
    conversationId: string,
    userId: string,
): Promise<ChatConversation | null> {
    const conversations = await listConversations(userId);
    return conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

/// A page of the main timeline, oldest-first.
///
/// `before` is the createdAt of the oldest message already held, so paging up is "give me
/// what came before this". Cursoring on a timestamp rather than an offset means messages
/// arriving while someone reads history cannot shift the page under them.
export async function getMessages(
    conversationId: string,
    userId: string,
    options: { before?: string; limit?: number } = {},
): Promise<MessagePage> {
    if (!(await isMember(conversationId, userId))) {
        return { messages: [], nextCursor: null };
    }

    const limit = options.limit ?? PAGE_SIZE;

    const rows = await prisma.messages.findMany({
        where: {
            conversation_id: conversationId,
            // Thread replies live behind their parent, not in the timeline.
            parent_id: null,
            ...(options.before ? { created_at: { lt: new Date(options.before) } } : {}),
        },
        include: MESSAGE_INCLUDE,
        orderBy: { created_at: "desc" },
        // One more than asked for: if it comes back, there is another page, and we learn
        // that without a second count query.
        take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
        // Queried newest-first for the cursor, handed back oldest-first for the reader.
        messages: page.reverse().map(toMessage),
        nextCursor: hasMore ? page[0].created_at.toISOString() : null,
    };
}

/// Every reply hanging off one message, oldest-first. Threads are one level deep and
/// expected to be short, so this is not paginated.
export async function getThread(
    parentId: string,
    userId: string,
): Promise<ChatMessage[]> {
    const parent = await prisma.messages.findUnique({
        where: { id: parentId },
        select: { conversation_id: true },
    });

    if (!parent || !(await isMember(parent.conversation_id, userId))) return [];

    const rows = await prisma.messages.findMany({
        where: { parent_id: parentId },
        include: MESSAGE_INCLUDE,
        orderBy: { created_at: "asc" },
    });

    return rows.map(toMessage);
}

/// One message in the shape every other surface uses.
///
/// Unscoped by design — its only caller is sendMessage, reading back a row it just created
/// after already proving membership. Do not expose it to anything holding a client-supplied
/// id without a membership check in front of it.
export async function getMessageById(messageId: string): Promise<ChatMessage | null> {
    const row = await prisma.messages.findUnique({
        where: { id: messageId },
        include: MESSAGE_INCLUDE,
    });

    return row ? toMessage(row) : null;
}

/// The membership check every read and write in this module goes through.
///
/// Exported because lib/chat/mutations.ts needs the same question answered, and two
/// implementations of "may this person touch this conversation" is one more than is safe.
export async function isMember(conversationId: string, userId: string): Promise<boolean> {
    const membership = await prisma.conversation_members.findUnique({
        where: {
            conversation_id_profile_id: { conversation_id: conversationId, profile_id: userId },
        },
        select: { profile_id: true },
    });

    return membership !== null;
}
