"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/dal";
import { formGroupFor, getGroupFor, type FormGroupFailure } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { createGroupChannel } from "@/lib/stream";

export type FindMyGroupResult = { ok: true } | { ok: false; reason: FormGroupFailure };

/// Assigns the caller a group and opens its Stream channel.
///
/// Postgres first, Stream second — deliberately the opposite of sayHi in
/// app/(app)/meet/actions.ts. There the Postgres row hides someone from Meet, so writing
/// it before the channel exists is the harmful order. Here the row is a *claim* on people
/// who can each only be claimed once, so it has to be taken atomically before anything
/// observable happens: creating the channel first and then losing the race would leave
/// three or four people holding a group channel that no row points at and nothing can
/// ever reclaim, once per retry.
///
/// The window this opens — row committed, channel missing — is closed by
/// stream_channel_id staying NULL and by the branch below that finishes the job.
export async function findMyGroup(): Promise<FindMyGroupResult> {
    const profile = await requireProfile();

    // Already grouped: the only work left is finishing a channel that failed to create.
    // Re-running formation here would be wrong — they'd be selecting a second group.
    const existing = await getGroupFor(profile.id);
    if (existing) {
        if (!existing.streamChannelId) {
            await finishChannel(existing.id, existing.title, existing.members, profile.id);
            revalidatePath("/chats");
        }
        return { ok: true };
    }

    const result = await formGroupFor(profile);
    if (!result.ok) return result;

    await finishChannel(
        result.group.id,
        result.group.title,
        result.group.members,
        profile.id,
    );

    revalidatePath("/chats");
    return { ok: true };
}

async function finishChannel(
    groupId: string,
    title: string,
    members: { id: string; username: string }[],
    createdById: string,
) {
    await createGroupChannel(groupId, title, members, createdById);

    // Only now is the group usable, so only now does the card stop offering to retry.
    await prisma.groups.update({
        where: { id: groupId },
        data: { stream_channel_id: groupId },
    });
}
