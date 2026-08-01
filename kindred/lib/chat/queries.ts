import "server-only";

import {
    MEMBER_SELECT,
    MESSAGE_INCLUDE,
    previewFor,
    toMember,
    toMessage,
} from "@/lib/chat/mapping";
import { getChatLevel } from "@/lib/chat-level";
import { dailyBonusThreshold, utcDay } from "@/lib/confidence-xp";
import { prisma } from "@/lib/prisma";
import type {
    ChatConversation,
    ChatMessage,
    ConversationKind,
    ConversationXp,
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

/// How many conversations the list loads. Generous rather than tuned: the point is that the
/// query has a ceiling at all, since it fans out to every member of every conversation
/// returned. Someone who reaches this needs paging in the sidebar, which is a feature rather
/// than a number to raise.
const CONVERSATION_LIMIT = 100;

/// Every conversation this person is in, newest activity first.
///
/// Three queries rather than one: the conversations with their members, then unread counts,
/// then previews. The last two are raw SQL because neither is expressible in Prisma without
/// a query per conversation — unread compares each message against a cutoff that differs per
/// row, and "the newest message in each conversation" is a DISTINCT ON.
export async function listConversations(userId: string): Promise<ChatConversation[]> {
    const memberships = await prisma.conversation_members.findMany({
        where: { profile_id: userId },
        // Ordered and bounded in SQL rather than in JS afterwards. This runs in the app-shell
        // layout — on /meet and /me too, not only /chats — because the unread badges it feeds
        // have to work from every tab, so it is the most frequently run query in the app and
        // the one least able to afford loading everything.
        //
        // nulls first is not incidental: a conversation with no messages is a wave nobody has
        // answered, and that belongs at the top rather than buried under months of history.
        orderBy: { conversation: { last_message_at: { sort: "desc", nulls: "first" } } },
        take: CONVERSATION_LIMIT,
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
                        select: {
                            last_read_at: true,
                            profile: { select: MEMBER_SELECT },
                        },
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
        const otherMembers = conversation.members.filter(
            (member) => member.profile.id !== userId,
        );
        const others = otherMembers.map((member) => toMember(member.profile));

        // Only other people's timestamps: your own tells you nothing about whether anyone
        // has seen what you said.
        const readBy = Object.fromEntries(
            otherMembers.map((member) => [
                member.profile.id,
                member.last_read_at.toISOString(),
            ]),
        );

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
            readBy,
        };
    });

    // Sorted here rather than in SQL because the ordering key lives on the conversation
    // while the query above is anchored on membership. A conversation with no messages yet
    // — a wave — sorts to the top, which is where a brand new request belongs.
    return conversations;
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
export async function getConversation({
    conversationId,
    userId,
}: {
    conversationId: string;
    userId: string;
}): Promise<ChatConversation | null> {
    const conversations = await listConversations(userId);
    return conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

/// The XP badge in a conversation's header: its shared total, and the viewer's own progress
/// toward today's mutual bonus.
///
/// Null for a non-member, same as getConversation — "not yours" and "does not exist" have to
/// look identical from outside.
///
/// A conversation with no channel_xp row has simply never had a qualifying message in it,
/// which is zero rather than an error. The badge draws level 1 from that without a special
/// case, because level 1 is what zero XP means.
export async function getConversationXp({
    conversationId,
    userId,
}: {
    conversationId: string;
    userId: string;
}): Promise<ConversationXp | null> {
    if (!(await isMember({ conversationId, userId }))) return null;

    const day = utcDay();

    const [row, activity, bonus] = await Promise.all([
        prisma.channel_xp.findUnique({
            where: { conversation_id: conversationId },
            select: { xp: true },
        }),
        prisma.daily_chat_activity.findUnique({
            where: {
                conversation_id_profile_id_day: {
                    conversation_id: conversationId,
                    profile_id: userId,
                    day,
                },
            },
            select: { qualifying_messages: true },
        }),
        prisma.daily_bonus_awards.findUnique({
            where: { conversation_id_day: { conversation_id: conversationId, day } },
            select: { xp_awarded: true },
        }),
    ]);

    const xp = row?.xp ?? 0;
    const { level, xpIntoLevel, xpForNextLevel } = getChatLevel(xp);

    return {
        xp,
        level,
        xpIntoLevel,
        xpForNextLevel,
        messagesToday: activity?.qualifying_messages ?? 0,
        bonusThreshold: dailyBonusThreshold(level),
        bonusEarnedToday: !!bonus,
        bonusXpToday: bonus?.xp_awarded ?? null,
    };
}

/// A page of the main timeline, oldest-first.
///
/// `before` is the createdAt of the oldest message already held, so paging up is "give me
/// what came before this". Cursoring on a timestamp rather than an offset means messages
/// arriving while someone reads history cannot shift the page under them.
export async function getMessages({
    conversationId,
    userId,
    before,
    limit = PAGE_SIZE,
}: {
    conversationId: string;
    userId: string;
    before?: string;
    limit?: number;
}): Promise<MessagePage> {
    if (!(await isMember({ conversationId, userId }))) {
        return { messages: [], nextCursor: null };
    }

    const rows = await prisma.messages.findMany({
        where: {
            conversation_id: conversationId,
            // Thread replies live behind their parent, not in the timeline.
            parent_id: null,
            ...(before ? { created_at: { lt: new Date(before) } } : {}),
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
export async function getThread({
    parentId,
    userId,
}: {
    parentId: string;
    userId: string;
}): Promise<ChatMessage[]> {
    const parent = await prisma.messages.findUnique({
        where: { id: parentId },
        select: { conversation_id: true },
    });

    if (!parent || !(await isMember({ conversationId: parent.conversation_id, userId }))) {
        return [];
    }

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
///
/// Named arguments, like everything here taking more than one id: both are uuid strings, so
/// calling it the other way round type-checks perfectly and then denies access to a member
/// forever. That reads as a permissions bug rather than a typo, which is the worst kind.
export async function isMember({
    conversationId,
    userId,
}: {
    conversationId: string;
    userId: string;
}): Promise<boolean> {
    const membership = await prisma.conversation_members.findUnique({
        where: {
            conversation_id_profile_id: { conversation_id: conversationId, profile_id: userId },
        },
        select: { profile_id: true },
    });

    return membership !== null;
}
