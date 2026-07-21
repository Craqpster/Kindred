import ChatClient from "@/components/chat/ChatClient";
import type { ChatTab } from "@/components/chat/ChatTabs";
import { requireProfile } from "@/lib/dal";
import { streamServerClient } from "@/lib/stream";

// The shell already gated auth + onboarding, and ChatConnectionProvider (in the
// layout) already holds the live Stream connection. We only need the id to filter
// this user's channels.
//
// Three params, all set by redirects from /meet:
//   ?c=     the channel to open. An id, not a cid.
//   ?type=  its channel type — "team" for a group, "messaging" for a 1:1. Carried rather
//           than guessed so the client can construct the channel directly instead of
//           hunting for it in a list it may not be on yet.
//   ?greet= present only for a wave, which is the one case that prefills 👋. Opening and
//           greeting used to be the same flag, which put a 👋 in new group chats.
//
// searchParams is a Promise in Next 16 and must be awaited.
export default async function ChatsPage({
    searchParams,
}: {
    searchParams: Promise<{ c?: string; type?: string; greet?: string }>;
}) {
    const [profile, { c, type, greet }] = await Promise.all([
        requireProfile(),
        searchParams,
    ]);

    const channelType = type === "team" ? "team" : "messaging";

    // Which tab to open on. A fresh wave is Pending, so defaulting to Active would land the
    // user on a list that doesn't contain the conversation they were just sent to. Read from
    // the channel rather than passed in the redirect, so it stays true if the state changed
    // between the redirect being built and the page loading.
    //
    // Server-side to avoid rendering Active and correcting once the channel list arrives.
    // Only runs on the redirect path — a normal visit to /chats has no `?c=`.
    const initialTab = c ? await tabFor(channelType, c) : "active";

    return (
        <ChatClient
            userId={profile.id}
            openChannelId={c}
            openChannelType={channelType}
            greet={greet === "1"}
            initialTab={initialTab}
        />
    );
}

async function tabFor(type: "messaging" | "team", id: string): Promise<ChatTab> {
    const [channel] = await streamServerClient.queryChannels({ type, id });
    // Groups never carry requested_of, so they land on Active without a special case.
    return channel?.data?.requested_of ? "pending" : "active";
}
