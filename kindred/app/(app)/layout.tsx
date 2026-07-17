import SidebarNav from "@/components/app/SidebarNav";
import { requireProfile } from "@/lib/dal";

// The authenticated shell. requireProfile() gates every tab in one place: no session
// redirects to /login, no profile redirects to /onboarding. cache() means the tab pages
// can call it again without a second round-trip.
//
// Onboarding, login, signup and the landing page live OUTSIDE this group, so they get
// no sidebar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const profile = await requireProfile();

    return (
        <div className="flex min-h-screen flex-col bg-chantilly sm:flex-row">
            <SidebarNav username={profile.username} />
            <main className="flex flex-1 flex-col">{children}</main>
        </div>
    );
}
