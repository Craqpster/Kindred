import ChatClient from "@/components/chat/ChatClient";
import { requireProfile } from "@/lib/dal";
import { getGroupFor } from "@/lib/groups";

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

    // The group chat is fetched here rather than in ChatClient so the card renders with
    // the roster already in hand — no client-side flash between "Find your group" and an
    // existing group. Group channels are type "team", so they never appear in the
    // ChannelList below, which filters on "messaging".
    const group = await getGroupFor(profile.id);

    return <ChatClient userId={profile.id} greetChannelId={c} group={group} />;
}