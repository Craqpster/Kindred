import ChatClient from "@/components/chat/ChatClient";
import { requireProfile } from "@/lib/dal";

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

    return (
        <ChatClient
            userId={profile.id}
            openChannelId={c}
            openChannelType={type === "team" ? "team" : "messaging"}
            greet={greet === "1"}
        />
    );
}
