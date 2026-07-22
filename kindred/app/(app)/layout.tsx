import { requireProfile } from "@/lib/dal";
import AppDock from "@/components/app/AppDock";
import AppProviders from "@/components/chat/AppProviders";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const profile = await requireProfile();

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
                <AppProviders profile={profile}>
                    {children}
                </AppProviders>
            </main>
        </div>
    );
}