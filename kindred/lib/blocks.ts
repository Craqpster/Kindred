import "server-only";

import { prisma } from "@/lib/prisma";

// Who cannot see whom.
//
// The table stores a direction, because blocking is something one person does. Every read here
// ignores it: a row in either direction means the two of them stop appearing to each other,
// full stop. Only `unblock` cares who did it.
//
// That symmetry is the point. If it were one-way, blocking somebody would hide them from you
// while leaving you visible to them, which protects the wrong person.
//
// These are gates, not filters. Nothing here decides what a page looks like; it decides whether
// a person is reachable at all, and the callers turn that into "no such profile" or an empty
// list rather than an error. Somebody who has been blocked should not be able to tell the
// difference between that and an account that was deleted.

/// Everyone this person cannot interact with, in either direction.
///
/// One query, returning ids rather than rows, because every caller wants it as an exclusion
/// list for a `notIn`. Callers that need a single yes-or-no should use `isBlockedBetween`.
export async function blockedIdsFor(userId: string): Promise<string[]> {
    const rows = await prisma.blocks.findMany({
        where: { OR: [{ blocker_id: userId }, { blocked_id: userId }] },
        select: { blocker_id: true, blocked_id: true },
    });

    // Each row names two people and one of them is always the caller. Collecting both columns
    // and dropping the caller is shorter than branching per row, and a Set keeps it unique when
    // two people have somehow blocked each other.
    const ids = new Set<string>();
    for (const row of rows) {
        ids.add(row.blocker_id);
        ids.add(row.blocked_id);
    }
    ids.delete(userId);

    return [...ids];
}

/// Whether these two are blocked from each other, whoever did it.
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
    const existing = await prisma.blocks.findFirst({
        where: {
            OR: [
                { blocker_id: a, blocked_id: b },
                { blocker_id: b, blocked_id: a },
            ],
        },
        select: { blocker_id: true },
    });

    return existing !== null;
}

/// Whether any member of a conversation is blocked from this person.
///
/// Group chats are the reason this exists. A DM has one other person, so a block clearly means
/// the conversation goes away; a group might contain someone you blocked alongside two people
/// you did not. Hiding the whole group is the conservative reading, and the honest one: there
/// is no way to be in a room with somebody and not see what they say.
export async function conversationIsBlocked(
    conversationId: string,
    userId: string,
): Promise<boolean> {
    const blockedIds = await blockedIdsFor(userId);
    if (blockedIds.length === 0) return false;

    const member = await prisma.conversation_members.findFirst({
        where: { conversation_id: conversationId, profile_id: { in: blockedIds } },
        select: { profile_id: true },
    });

    return member !== null;
}

/// Blocks somebody. Idempotent, so a double tap is not an error.
///
/// The CHECK constraint refuses a self-block, but catching it here means the caller gets a
/// plain false rather than a raised constraint violation.
export async function block(blockerId: string, blockedId: string): Promise<boolean> {
    if (blockerId === blockedId) return false;

    await prisma.blocks.upsert({
        where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: blockedId } },
        create: { blocker_id: blockerId, blocked_id: blockedId },
        update: {},
    });

    return true;
}

/// Undoes your own block. Cannot undo one somebody else placed on you, which is what the
/// stored direction is for.
export async function unblock(blockerId: string, blockedId: string): Promise<boolean> {
    const { count } = await prisma.blocks.deleteMany({
        where: { blocker_id: blockerId, blocked_id: blockedId },
    });

    return count > 0;
}

/// Everyone this person has blocked, for a manage-blocks list. Only their own blocks, since
/// those are the only ones they can undo.
export async function listBlocked(userId: string) {
    const rows = await prisma.blocks.findMany({
        where: { blocker_id: userId },
        select: {
            created_at: true,
            blocked: { select: { id: true, username: true, avatar_id: true, avatar_seed: true } },
        },
        orderBy: { created_at: "desc" },
    });

    return rows.map((row) => ({
        id: row.blocked.id,
        username: row.blocked.username,
        avatarId: row.blocked.avatar_id,
        avatarSeed: row.blocked.avatar_seed,
        blockedAt: row.created_at.toISOString(),
    }));
}
