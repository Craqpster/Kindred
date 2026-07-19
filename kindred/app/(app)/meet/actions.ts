"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createDirectChannel } from "@/lib/stream";

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

    await prisma.connections.upsert({
        where: { user_id_other_id: { user_id: userId, other_id: otherId } },
        create: { user_id: userId, other_id: otherId, status: "greeted" },
        update: { status: "greeted" },
    });

    revalidatePath("/meet");

    // A connections row is one-directional (who greeted whom). It's a mutual match, and
    // a chat should exist, once the other person's row back to us also says "greeted".
    const reciprocal = await prisma.connections.findUnique({
        where: { user_id_other_id: { user_id: otherId, other_id: userId } },
    });

    if (reciprocal?.status === "greeted") {
        await createDirectChannel(userId, otherId);
    }
}