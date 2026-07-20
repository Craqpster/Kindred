import ChatClient from "@/components/chat/ChatClient";
import { requireProfile } from "@/lib/dal";
import { getGroupFor } from "@/lib/groups";
import { streamServerClient } from "@/lib/stream";

// The shell already gated auth + onboarding, and ChatConnectionProvider (in the
// layout) already holds the live Stream connection. We only need the id to filter
// this user's channels.
//
// `?c=<channel id>` is set when arriving from a wave on /meet: it opens that
// conversation and prefills the greeting. It carries the channel id, not the cid —
// customActiveChannel queries Stream by id and rejects a cid.
//
// searchParams is a Promise in Next 16 and must be awaited.
export default async function ChatsPage({
    searchParams,
}: {
    searchParams: Promise<{ c?: string }>;
}) {
    const [profile, { c }] = await Promise.all([requireProfile(), searchParams]);

    // Counted server-side so the badge is right on first paint. It refreshes when a request
    // is accepted (acceptRequest revalidates this path); a wave arriving while the page sits
    // open won't bump it until a navigation. Wiring that to the notification.message_new
    // listener in ChatConnectionProvider is the follow-up.
    const [requests, group] = await Promise.all([
        streamServerClient.queryChannels({
            type: "messaging",
            members: { $in: [profile.id] },
            requested_of: profile.id,
        }),
        getGroupFor(profile.id),
    ]);

    return (
        <ChatClient
            userId={profile.id}
            greetChannelId={c}
            requestCount={requests.length}
            group={group}
        />
    );
}