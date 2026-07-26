"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createGroupConversation, startDm } from "@/lib/chat/mutations";
import { requireProfile, verifySession } from "@/lib/dal";
import { formGroupFor, getGroupFor, type FormGroupFailure } from "@/lib/groups";
import { MEET_VIEW_COOKIE, meetViewSchema } from "@/lib/meet-view";
import { postIcebreakerPrompt } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";

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

    // Did they wave at us first? Answered from Postgres rather than Stream because we
    // already write a connections row per wave, so this is one lookup on that table's
    // primary key.
    //
    // Safe to stamp a request when this is false: getMatchesFor excludes anyone the user
    // already has a connections row for, so a non-mutual wave is always genuine first
    // contact and can never re-open a live conversation as Pending.
    const theyWavedFirst = await prisma.connections.findUnique({
        where: { user_id_other_id: { user_id: otherId, other_id: userId } },
        select: { user_id: true },
    });

    // The conversation first, the connections row second. If the conversation fails, no
    // connections row is written, so the card stays on Meet and the wave can be retried.
    // The other order would hide the person with no conversation to show for it. The
    // opposite failure self-heals: dm_key is unique per pair, so a retry reuses it.
    const { conversationId, created } = await startDm({
        senderId: userId,
        recipientId: otherId,
        mutual: !!theyWavedFirst,
    });

    // Only into a genuinely fresh conversation. A retried wave reuses the existing one, and
    // re-posting a prompt into a chat that already has messages would just be noise.
    //
    // `created` replaces what used to be a round trip to Stream asking whether the channel
    // had any messages yet — startDm already knows, since it either inserted the row or
    // found one.
    if (created) {
        await postIcebreakerPrompt(conversationId);
    }

    await prisma.connections.upsert({
        where: { user_id_other_id: { user_id: userId, other_id: otherId } },
        create: { user_id: userId, other_id: otherId, status: "greeted" },
        update: { status: "greeted" },
    });

    revalidatePath("/meet");

    // greet=1 is what prefills the 👋 — opening a conversation no longer implies greeting
    // it, since forming a group redirects here too and should arrive with an empty composer.
    //
    // No `type` any more: a conversation id identifies a conversation on its own, where a
    // Stream channel id was only unique within its type.
    redirect(`/chats?c=${encodeURIComponent(conversationId)}&greet=1`);
}

// void covers the success path: it redirects instead of returning, so the caller only ever
// receives a value when something went wrong.
export type FindMyGroupResult = { ok: false; reason: FormGroupFailure } | void;

/// Assigns the caller a group and opens its conversation.
///
/// The group row first, the conversation second — deliberately the opposite of sayHi above.
/// There the Postgres row hides someone from Meet, so writing it before the conversation
/// exists is the harmful order. Here the row is a *claim* on people who can each only be
/// claimed once, so it has to be taken atomically before anything observable happens:
/// creating the conversation first and then losing the race would leave three or four people
/// holding a conversation that no group points at and nothing can ever reclaim.
///
/// The window this opens — group committed, conversation missing — is closed by the repair
/// branch below, which is why the group card can offer to retry.
export async function findMyGroup(): Promise<FindMyGroupResult> {
    const profile = await requireProfile();

    // Already grouped: the only work left is finishing a conversation that failed to create.
    // Re-running formation here would be wrong — they'd be selecting a second group.
    const existing = await getGroupFor(profile.id);
    if (existing) {
        const conversationId = await finishGroupConversation(
            existing.id,
            existing.title,
            existing.members,
        );
        revalidatePath("/meet");
        openGroup(conversationId);
    }

    const result = await formGroupFor(profile);
    if (!result.ok) return result;

    const conversationId = await finishGroupConversation(
        result.group.id,
        result.group.title,
        result.group.members,
    );

    // The card lives here, but the group itself surfaces on /chats — revalidate both so
    // the Active tab has it the moment the user lands.
    revalidatePath("/meet");
    revalidatePath("/chats");

    openGroup(conversationId);
}

/// Sends the user into their group conversation.
///
/// No greet=1: unlike a wave, a group should open with an empty composer.
///
/// Must not be called from inside a try — redirect() signals by throwing NEXT_REDIRECT, and
/// a catch would swallow the navigation and look like a silent no-op.
function openGroup(conversationId: string): never {
    redirect(`/chats?c=${encodeURIComponent(conversationId)}`);
}

/// Creates the group's conversation if it does not have one yet, and returns its id.
///
/// Safe to call on a group that already has one: createGroupConversation is keyed by
/// group_id, so it finds the existing row rather than making a second. That is what makes
/// the repair branch above a plain call instead of a conditional.
async function finishGroupConversation(
    groupId: string,
    title: string,
    members: { id: string; username: string }[],
): Promise<string> {
    const { conversationId, created } = await createGroupConversation({
        groupId,
        title,
        memberIds: members.map((member) => member.id),
    });

    if (created) {
        await postIcebreakerPrompt(conversationId);
    }

    return conversationId;
}
