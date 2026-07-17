import ChatClient from "@/components/chat/ChatClient";
import { requireProfile } from "@/lib/dal";

// The shell already gated auth + onboarding. We only need the handle to pass to Stream.
export default async function ChatsPage() {
    const profile = await requireProfile();
    return <ChatClient userId={profile.id} username={profile.username} />;
}
