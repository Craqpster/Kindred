"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { acceptChatRequest, renameGroupChannel } from "@/lib/stream";

// Stream channel ids from startChatRequest are of its own generation, not uuids, so this
// only bounds the shape — acceptChatRequest does the real check that this request was
// actually sent to the caller.
const channelId = z.string().min(1).max(64);

/// Accepts an incoming wave, moving it from the Requests tab into Active.
export async function acceptRequest(formData: FormData) {
    const { userId } = await verifySession();

    const parsed = channelId.safeParse(formData.get("channel_id"));
    if (!parsed.success) return;

    await acceptChatRequest(parsed.data, userId);

    revalidatePath("/chats");
}

// 255 to match Stream's own cap on a channel name; trimmed and non-empty so a name made
// only of spaces cannot replace a real one.
const renameInput = z.object({
    channel_id: channelId,
    name: z.string().trim().min(1).max(255),
});

/// Renames a group chat. Any member may do it — renameGroupChannel does the real check.
///
/// Writes BOTH stores on purpose. Every chat surface reads the name from Stream, so
/// Postgres is not needed for display — but findMyGroup's repair branch re-pushes
/// groups.title onto the channel, so leaving it stale would let the formation-time tag
/// silently overwrite a rename later.
export async function renameGroup(formData: FormData) {
    const { userId } = await verifySession();

    const parsed = renameInput.safeParse({
        channel_id: formData.get("channel_id"),
        name: formData.get("name"),
    });
    if (!parsed.success) return;

    const { channel_id, name } = parsed.data;

    await renameGroupChannel(channel_id, userId, name);

    // updateMany, not update: the group row is keyed by stream_channel_id, and a channel
    // with no matching row should be a no-op rather than a throw that undoes the rename
    // the user just saw succeed.
    await prisma.groups.updateMany({
        where: { stream_channel_id: channel_id },
        data: { title: name },
    });

    revalidatePath("/chats");
}