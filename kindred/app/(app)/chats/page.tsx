import ChatClient from "@/components/chat/ChatClient";
import { requireProfile } from "@/lib/dal";

// The shell already gated auth + onboarding, and ChatConnectionProvider (in the
// layout) already holds the live Stream connection. We only need the id to filter
// this user's channels.
export default async function ChatsPage() {
    const profile = await requireProfile();
    return <ChatClient userId={profile.id} />;
}
