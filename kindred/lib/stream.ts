import "server-only";

import { StreamChat } from "stream-chat";

import { prisma } from "@/lib/prisma";

const api_key = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const api_secret = process.env.STREAM_SECRET;

if (!api_key || !api_secret) {
    throw new Error("Missing STREAM env vars");
}

export const streamServerClient = StreamChat.getInstance(api_key, api_secret);

/// Called once two users have both said hi to each other. Creates a 1:1 Stream channel
/// for them. Omitting a channel id makes Stream treat this as a "distinct" channel for
/// this exact pair of members, so calling it again for the same pair is a safe no-op
/// rather than a duplicate channel.
export async function createDirectChannel(userIdA: string, userIdB: string) {
    const [profileA, profileB] = await Promise.all([
        prisma.profiles.findUniqueOrThrow({ where: { id: userIdA } }),
        prisma.profiles.findUniqueOrThrow({ where: { id: userIdB } }),
    ]);

    // Both people must exist as Stream users before they can be added to a channel —
    // the one who didn't say hi first may never have visited /chats yet.
    await streamServerClient.upsertUsers([
        { id: profileA.id, name: profileA.username },
        { id: profileB.id, name: profileB.username },
    ]);

    // created_by_id is required when creating a channel with server-side (API secret)
    // auth — Stream has no other way to know which user "made" it. Who it names doesn't
    // matter for a mutual match; A is as good as B.
    const channel = streamServerClient.channel("messaging", {
        members: [profileA.id, profileB.id],
        created_by_id: profileA.id,
    });
    await channel.create();
}
