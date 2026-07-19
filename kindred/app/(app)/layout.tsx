import ChatConnectionProvider from "@/components/chat/ChatConnectionProvider";
import SidebarNav from "@/components/app/SidebarNav";
import { requireProfile } from "@/lib/dal";

// The authenticated shell. requireProfile() gates every tab in one place: no session
// redirects to /login, no profile redirects to /onboarding. cache() means the tab pages
// can call it again without a second round-trip.
//
// Onboarding, login, signup and the landing page live OUTSIDE this group, so they get
// no sidebar.
//
// ChatConnectionProvider wraps every tab, not just /chats: the Stream connection is
// meant to live for the whole authenticated session, not be torn down and rebuilt on
// every tab switch. See its own comment for why that reconnect churn was a real bug.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const profile = await requireProfile();

    return (
        // The shell is locked to the viewport height and only <main> scrolls. Without
        // this, a long list of children grows the whole page and the fixed-height aside
        // scrolls off, exposing the background beneath it.
        <div className="flex h-dvh flex-col overflow-hidden sm:flex-row">
            <SidebarNav username={profile.username} />
            <main className="flex flex-1 flex-col overflow-y-auto bg-mist">
                <ChatConnectionProvider userId={profile.id} username={profile.username}>
                    {children}
                </ChatConnectionProvider>
            </main>
        </div>
    );
}
