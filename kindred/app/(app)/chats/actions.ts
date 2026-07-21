"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/dal";
import { acceptChatRequest } from "@/lib/stream";

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