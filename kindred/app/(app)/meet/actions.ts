"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createDirectChannel } from "@/lib/stream";

// Both actions record a directional connection and let revalidation drop the card — the
// matcher excludes anyone the user already has a connections row for.

const targetId = z.uuid();

async function record(formData: FormData, status: "greeted" | "dismissed") {
    const { userId } = await verifySession();

    const parsed = targetId.safeParse(formData.get("other_id"));
    if (!parsed.success) return null;

    // A user cannot connect to themselves.
    if (parsed.data === userId) return null;

    const otherId = parsed.data;

    await prisma.connections.upsert({
        where: { user_id_other_id: { user_id: userId, other_id: otherId } },
        create: { user_id: userId, other_id: otherId, status },
        update: { status },
    });

    revalidatePath("/meet");
    return { userId, otherId };
}

export async function sayHi(formData: FormData) {
    const result = await record(formData, "greeted");
    if (!result) return;

    const { userId, otherId } = result;

    // A connections row is one-directional (who greeted whom). It's a mutual match, and
    // a chat should exist, once the other person's row back to us also says "greeted".
    const reciprocal = await prisma.connections.findUnique({
        where: { user_id_other_id: { user_id: otherId, other_id: userId } },
    });

    if (reciprocal?.status === "greeted") {
        await createDirectChannel(userId, otherId);
    }
}

export async function notNow(formData: FormData) {
    await record(formData, "dismissed");
}