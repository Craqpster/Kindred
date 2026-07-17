"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// Both actions record a directional connection and let revalidation drop the card — the
// matcher excludes anyone the user already has a connections row for.
//
// "Record intent only": say hi does NOT create a Stream channel yet. That comes with a
// later pass; for now it just marks that the user reached out.

const targetId = z.uuid();

async function record(formData: FormData, status: "greeted" | "dismissed") {
    const { userId } = await verifySession();

    const parsed = targetId.safeParse(formData.get("other_id"));
    if (!parsed.success) return;

    // A user cannot connect to themselves.
    if (parsed.data === userId) return;

    await prisma.connections.upsert({
        where: { user_id_other_id: { user_id: userId, other_id: parsed.data } },
        create: { user_id: userId, other_id: parsed.data, status },
        update: { status },
    });

    revalidatePath("/meet");
}

export async function sayHi(formData: FormData) {
    await record(formData, "greeted");
}

export async function notNow(formData: FormData) {
    await record(formData, "dismissed");
}