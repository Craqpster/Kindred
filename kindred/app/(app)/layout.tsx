import { requireProfile } from "@/lib/dal";
import AppDock from "@/components/app/AppDock";
import AppProviders from "@/components/chat/AppProviders";
import { listConversations } from "@/lib/chat/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const profile = await requireProfile();

    // Loaded in the layout, not on /chats, because the unread badges and new-message toasts
    // this feeds have to work from every tab. It costs one query per navigation within the
    // shell, which is the same trade Stream's shell-level connection made.
    const conversations = await listConversations(profile.id);

    return (
        <div className="relative flex h-screen w-screen overflow-hidden bg-bone-100 font-body text-ink-900">
            {/* Fixed AppDock stays pinned in place */}
            <AppDock
                username={profile.username}
                avatarId={profile.avatar_id}
                avatarSeed={profile.avatar_seed}
            />

            {/* Main container fills the remaining space and handles scrolling */}
            <main className="relative flex-1 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <AppProviders userId={profile.id} conversations={conversations}>
                    {children}
                </AppProviders>
            </main>
        </div>
    );
}