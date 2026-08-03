import { notFound } from "next/navigation";

import ViewProfile from "@/components/profile/ViewProfile";
import { requireProfile } from "@/lib/dal";
import { getViewableProfile } from "@/lib/profiles";

/// Somebody else's profile, reachable from a conversation header or a Meet card.
///
/// `notFound()` rather than a "you cannot see this" page, and that is the point: a stranger
/// gets the same answer for a profile they are not allowed to open as for one that does not
/// exist. Distinguishing them would turn this route into a way to check which accounts are
/// real.
export default async function ProfilePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const [viewer, { id }] = await Promise.all([requireProfile(), params]);

    const profile = await getViewableProfile(viewer.id, id);
    if (!profile) notFound();

    return (
        <div className="min-h-full flex-1 bg-bone-100 font-body text-ink-900">
            <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12">
                <ViewProfile profile={profile} />
            </div>
        </div>
    );
}
