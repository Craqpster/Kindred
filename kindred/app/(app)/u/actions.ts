"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { block, unblock } from "@/lib/blocks";
import { verifySession } from "@/lib/dal";

// Blocking, from a profile page.
//
// Thin, like every other action here: the rules live in lib/blocks.ts, and these exist to
// bound the input and re-derive who is asking. The blocker is always the session user and
// never comes from the payload, so nobody can block on somebody else's behalf.

const targetId = z.uuid();

/// Blocks somebody. Idempotent, so a double click is not an error.
///
/// Revalidates broadly on purpose. A block changes what four separate surfaces show: Meet
/// drops them from the cards, /chats loses the conversation, their profile stops resolving,
/// and the blocked list gains a row. Naming each path is cheaper than a layout-wide
/// invalidation and honest about the blast radius.
export async function blockUser(formData: FormData): Promise<void> {
    const { userId } = await verifySession();

    const parsed = targetId.safeParse(formData.get("profile_id"));
    if (!parsed.success) return;

    await block(userId, parsed.data);

    revalidatePath("/meet");
    revalidatePath("/chats");
    revalidatePath("/me");
}

/// Undoes your own block. lib/blocks.ts scopes the delete to rows this person created, so
/// this cannot lift a block somebody else placed.
export async function unblockUser(formData: FormData): Promise<void> {
    const { userId } = await verifySession();

    const parsed = targetId.safeParse(formData.get("profile_id"));
    if (!parsed.success) return;

    await unblock(userId, parsed.data);

    revalidatePath("/meet");
    revalidatePath("/chats");
    revalidatePath("/me");
}
