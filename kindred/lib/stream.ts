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
/// Returns the channel *id* so the caller can redirect straight into the conversation.
///
/// An id, not a cid. ChannelList's `customActiveChannel` matches on `chan.id` and falls
/// back to `queryChannels({ id })`, so handing it a cid ("messaging:!members-…") fails at
/// query time with "invalid id value, did you pass a channel cid instead of channel id?"
/// rather than at compile time.
///
/// `mutual` means the recipient already waved at the sender, so this wave is a reply rather
/// than a new request: both people have now reached out, which is exactly the condition the
/// Pending tab is defined by the absence of. In that case the request markers are cleared
/// instead of stamped, and the conversation lands in Active for both.
export async function startChatRequest(
    senderId: string,
    recipientId: string,
    { mutual = false }: { mutual?: boolean } = {},
) {
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
    // requested_by / requested_of mark this as a pending request, and the Pending tab
    // filters on requested_of. They are omitted on a mutual wave and unset below.
    const channel = streamServerClient.channel("messaging", {
        members: [sender.id, recipient.id],
        created_by_id: sender.id,
        ...(mutual ? {} : { requested_by: sender.id, requested_of: recipient.id }),
    });
    await channel.create();

    // Unset rather than simply not setting: this channel already exists (they waved first),
    // so it is carrying their request markers and create() will not remove them.
    if (mutual) {
        await channel.updatePartial({ unset: ["requested_by", "requested_of"] });
    }

    // Typed as optional because a channel has no id until it exists; create() assigns
    // one. Checked rather than asserted so a silent undefined can't become the string
    // "undefined" in the redirect URL.
    if (!channel.id) {
        throw new Error("Stream channel was created without an id");
    }

    return channel.id;
}

/// Accepts a wave: clears `requested_of` so the channel moves from the Requests tab to
/// Active.
export async function acceptChatRequest(channelId: string, userId: string) {
    const [channel] = await streamServerClient.queryChannels({
        type: "messaging",
        id: channelId,
        members: { $in: [userId] },
    });

    if (!channel) throw new Error("No such chat request");
    if (channel.data?.requested_of !== userId) {
        throw new Error("That request was not sent to you");
    }

    await channel.updatePartial({ unset: ["requested_of"] });
}

/// Opens the channel for a group formed by lib/groups.ts.
///
/// Type "team", not "messaging", so ChannelList's existing `{ type: "messaging" }` filter
/// leaves group channels out of the 1:1 list without a single change to that filter.
/// The two types ship with identical config and channel_member permissions.
///
/// Takes an explicit id — the group's uuid — which is the opposite of startChatRequest's
/// deliberately id-less distinct channel, and for a different reason: it makes create()
/// idempotent, so retrying after a failed run reuses the channel instead of orphaning one.
export async function createGroupChannel(
    groupId: string,
    title: string,
    members: { id: string; username: string }[],
    createdById: string,
) {
    await streamServerClient.upsertUsers(
        members.map((member) => ({ id: member.id, name: member.username })),
    );

    const channel = streamServerClient.channel("team", groupId, {
        name: title,
        members: members.map((member) => member.id),
        created_by_id: createdById,
    });
    await channel.create();

    return groupId;
}
