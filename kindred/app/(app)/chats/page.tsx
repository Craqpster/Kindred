import ChatClient from "@/components/chat/ChatClient";
import { requireProfile } from "@/lib/dal";

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

    return <ChatClient userId={profile.id} greetChannelId={c} />;
}