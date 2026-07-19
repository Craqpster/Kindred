"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { startChatRequest } from "@/lib/stream";

const targetId = z.uuid();

// Records that the user greeted someone and lets revalidation drop the card — the
// matcher excludes anyone the user already has a connections row for.
//
export async function sayHi(formData: FormData) {
    const { userId } = await verifySession();

    const parsed = targetId.safeParse(formData.get("other_id"));
    if (!parsed.success) return;

    // A user cannot connect to themselves.
    if (parsed.data === userId) return;

    const otherId = parsed.data;

    // Stream first, Postgres second. If channel creation fails, no connections row is
    // written, so the card stays on Meet and the wave can be retried. The other order
    // would hide the person with no conversation to show for it. The opposite failure
    // self-heals: the channel is "distinct" per member pair, so a retry reuses it.
    const cid = await startChatRequest(userId, otherId);

    await prisma.connections.upsert({
        where: { user_id_other_id: { user_id: userId, other_id: otherId } },
        create: { user_id: userId, other_id: otherId, status: "greeted" },
        update: { status: "greeted" },
    });

    revalidatePath("/meet");

    redirect(`/chats?c=${encodeURIComponent(cid)}`);
}