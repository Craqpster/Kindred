import "server-only";

import { prisma } from "@/lib/prisma";

/// Erasing an account.
///
/// The heart of it is one DELETE. `profiles.id` is a foreign key onto `auth.users.id` with
/// ON DELETE CASCADE, and sixteen more tables cascade off `profiles`, so removing the auth row
/// takes messages, reactions, connections, blocks, group memberships, badges, XP activity and
/// moderation strikes with it. Nothing here enumerates those tables, which is the point: a
/// table added next year is covered the day its foreign key is written, not the day somebody
/// remembers to update this file.
///
/// Prisma connects as `postgres`, which holds DELETE on `auth.users`. That is why this needs
/// neither a service role key in the environment nor a SECURITY DEFINER function to borrow
/// privileges it does not have.
export async function deleteAccount(userId: string): Promise<void> {
    // Read the DM list first: once the cascade runs there are no membership rows left to find
    // it from.
    const dms = await prisma.conversation_members.findMany({
        where: { profile_id: userId, conversation: { kind: "dm" } },
        select: { conversation_id: true },
    });

    await prisma.$transaction([
        // Waves are the one thing the cascade cannot handle on its own. `requested_by` and
        // `requested_of` are ON DELETE SET NULL, but conversations_request_check insists the
        // two are null together, and SET NULL only ever clears the one column that pointed at
        // the departing profile. Postgres would reject that UPDATE and take the whole delete
        // down with it, so the pair is cleared as a pair, first.
        //
        // Every wave is also a DM, so the next statement would remove these rows anyway. This
        // runs regardless, because it costs one indexed update and it stops the delete from
        // depending on an invariant maintained in a different file.
        prisma.conversations.updateMany({
            where: { OR: [{ requested_by: userId }, { requested_of: userId }] },
            data: { requested_by: null, requested_of: null },
        }),

        // A DM is only a DM because two people are in it. Leaving the row behind would show
        // the other person an untitled, empty thread they cannot place, since every message in
        // it was either theirs or the departing user's and the latter are about to be gone.
        // Groups are left alone: they outlive any one member.
        prisma.conversations.deleteMany({
            where: { id: { in: dms.map(({ conversation_id }) => conversation_id) } },
        }),

        prisma.users.delete({ where: { id: userId } }),
    ]);
}
