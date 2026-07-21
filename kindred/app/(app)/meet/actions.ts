"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProfile, verifySession } from "@/lib/dal";
import { formGroupFor, getGroupFor, type FormGroupFailure } from "@/lib/groups";
import { MEET_VIEW_COOKIE, meetViewSchema } from "@/lib/meet-view";
import { prisma } from "@/lib/prisma";
import { createGroupChannel, startChatRequest } from "@/lib/stream";

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
    const cid = await startChatRequest(userId, otherId);

    await prisma.connections.upsert({
        where: { user_id_other_id: { user_id: userId, other_id: otherId } },
        create: { user_id: userId, other_id: otherId, status: "greeted" },
        update: { status: "greeted" },
    });

    revalidatePath("/meet");

    // greet=1 is what prefills the 👋 — opening a channel no longer implies greeting it,
    // since forming a group redirects here too and should arrive with an empty composer.
    redirect(`/chats?c=${encodeURIComponent(cid)}&type=messaging&greet=1`);
}
// void covers the success path: it redirects instead of returning, so the caller only ever
// receives a value when something went wrong.
export type FindMyGroupResult = { ok: false; reason: FormGroupFailure } | void;

/// Assigns the caller a group and opens its Stream channel.
///
/// Postgres first, Stream second — deliberately the opposite of sayHi above. There the
/// Postgres row hides someone from Meet, so writing it before the channel exists is the
/// harmful order. Here the row is a *claim* on people who can each only be claimed once,
/// so it has to be taken atomically before anything observable happens: creating the
/// channel first and then losing the race would leave three or four people holding a group
/// channel that no row points at and nothing can ever reclaim, once per retry.
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
            revalidatePath("/meet");
        }
        openGroup(existing.id);
    }

    const result = await formGroupFor(profile);
    if (!result.ok) return result;

    await finishChannel(result.group.id, result.group.title, result.group.members, profile.id);

    // The card lives here, but the group itself surfaces on /chats — revalidate both so
    // the Active tab has it the moment the user lands.
    revalidatePath("/meet");
    revalidatePath("/chats");

    openGroup(result.group.id);
}

/// Sends the user into their group conversation.
///
/// No greet=1: unlike a wave, a group should open with an empty composer.
///
/// Must not be called from inside a try — redirect() signals by throwing NEXT_REDIRECT, and
/// a catch would swallow the navigation and look like a silent no-op.
function openGroup(groupId: string): never {
    // The Stream channel id is the group's own uuid — see createGroupChannel.
    redirect(`/chats?c=${encodeURIComponent(groupId)}&type=team`);
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
