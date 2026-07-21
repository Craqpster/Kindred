"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { verifySession } from "@/lib/dal";
import { MEET_VIEW_COOKIE, meetViewSchema } from "@/lib/meet-view";
import { postIcebreakerPrompt } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";
import { startChatRequest, streamServerClient } from "@/lib/stream";

const targetId = z.uuid();

// Remembers whether someone prefers the spotlight or the old dense grid.
export async function setMeetView(formData: FormData) {
    await verifySession();

    const parsed = meetViewSchema.safeParse(formData.get("view"));
    if (!parsed.success) return;

    const cookieStore = await cookies();
    cookieStore.set(MEET_VIEW_COOKIE, parsed.data, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        // Nothing on the client reads this — the server picks the layout.
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    });
    revalidatePath("/meet");
}

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
    const id = await startChatRequest(userId, otherId);

    // Only drop an icebreaker into a genuinely fresh conversation - startChatRequest
    // reuses the same "distinct" channel if this pair already has one (a retried wave,
    // say), and re-posting a prompt into an already-started chat would just be noise.
    const channel = streamServerClient.channel("messaging", id);
    const { messages } = await channel.query({ messages: { limit: 1 } });
    if (messages.length === 0) {
        await postIcebreakerPrompt(channel.cid);
    }

    await prisma.connections.upsert({
        where: { user_id_other_id: { user_id: userId, other_id: otherId } },
        create: { user_id: userId, other_id: otherId, status: "greeted" },
        update: { status: "greeted" },
    });

    revalidatePath("/meet");

    redirect(`/chats?c=${encodeURIComponent(id)}`);
}