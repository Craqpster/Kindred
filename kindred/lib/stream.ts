import "server-only";

import { StreamChat } from "stream-chat";

import { prisma } from "@/lib/prisma";

const api_key = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const api_secret = process.env.STREAM_SECRET;

if (!api_key || !api_secret) {
    throw new Error("Missing STREAM env vars");
}

export const streamServerClient = StreamChat.getInstance(api_key, api_secret);

/// Opens the 1:1 channel for a wave: `senderId` reaching out to `recipientId`.
///
/// Omitting a channel id makes Stream treat this as a "distinct" channel for this exact
/// pair of members, so waving at the same person twice reuses the conversation instead
/// of creating a second one.
///
/// Deliberately does NOT send a message. The greeting is prefilled into the sender's
/// composer (see components/chat/ChatClient.tsx) so they send it themselves.
///
/// Returns the channel cid so the caller can redirect straight into the conversation.
export async function startChatRequest(senderId: string, recipientId: string) {
    const [sender, recipient] = await Promise.all([
        prisma.profiles.findUniqueOrThrow({ where: { id: senderId } }),
        prisma.profiles.findUniqueOrThrow({ where: { id: recipientId } }),
    ]);

    // Both people must exist as Stream users before they can be added to a channel —
    // the recipient may never have visited /chats yet.
    await streamServerClient.upsertUsers([
        { id: sender.id, name: sender.username },
        { id: recipient.id, name: recipient.username },
    ]);

    // created_by_id is required when creating a channel with server-side (API secret)
    // auth — Stream has no other way to know which user "made" it.
    //
    // requested_by / requested_of are custom fields marking this as a pending request.
    // The Requests section will filter on requested_of; until that exists the channel
    // still lands in the recipient's normal list.
    const channel = streamServerClient.channel("messaging", {
        members: [sender.id, recipient.id],
        created_by_id: sender.id,
        requested_by: sender.id,
        requested_of: recipient.id,
    });
    await channel.create();

    return channel.cid;
}
