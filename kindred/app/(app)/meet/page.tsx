import { cookies } from "next/headers";

import FindGroupCard from "@/components/meet/FindGroupCard";
import MatchCard from "@/components/meet/MatchCard";
import MoreMatches from "@/components/meet/MoreMatches";
import RefreshMatches from "@/components/meet/RefreshMatches";
import SpotlightCard from "@/components/meet/SpotlightCard";
import ViewToggle from "@/components/meet/ViewToggle";
import { requireProfile } from "@/lib/dal";
import { getGroupFor } from "@/lib/groups";
import { getMatchesFor } from "@/lib/matches";
import { MEET_VIEW_COOKIE, meetViewFrom } from "@/lib/meet-view";

// How many matches share the opening screen with the spotlight. Everyone else is behind
const RUNNERS_UP = 3;

// Finding a group happens here; the group itself lives on /chats, pinned above the Active
// tab. FindGroupCard renders nothing once the user has one — there is nothing left to find.
//
// The page leads with one match rather than laying all ten out at once. getMatchesFor
// already ranks them, so an even grid was throwing that ordering away and asking the
// user to size up ten strangers in one go. One person, explained properly, is a smaller
// ask — and the rest are one click away rather than gone.
export default async function MeetPage() {
    const profile = await requireProfile();
    const [matches, group] = await Promise.all([
        getMatchesFor(profile),
        getGroupFor(profile.id),
    ]);

    const view = meetViewFrom((await cookies()).get(MEET_VIEW_COOKIE)?.value);

    const [top, ...others] = matches;
    const runnersUp = others.slice(0, RUNNERS_UP);
    const rest = others.slice(RUNNERS_UP);

    return (
        <div className="min-h-full flex-1 bg-bone-100 font-body text-ink-900">
            <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="font-display text-title">Meet</h1>
                        <p className="mt-1 text-body text-ink-600">
                            Start with one or two, you can always meet more.
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <ViewToggle view={view} />
                        <RefreshMatches />
                    </div>
                </div>

                {/* Renders nothing once they have a group, and carries its own top margin
                    so there is no empty spacer left behind when it does. */}
                <FindGroupCard group={group} />

                {matches.length === 0 ? (
                    <p className="mt-10 rounded-hero border border-ink-900/8 bg-surface p-10 text-center text-body text-ink-600 shadow-card">
                        No matches just yet. As more people join and share your hobbies and
                        interests, they&apos;ll show up here.
                    </p>
                ) : view === "grid" ? (
                    /* The flat view: every match at equal weight, no spotlight and no
                       reveal. Keeping a spotlight here would make the toggle a no-op. */
                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {matches.map((match) => (
                            <MatchCard key={match.id} match={match} />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="mt-8 flex flex-col gap-4">
                            <SpotlightCard match={top} />

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {runnersUp.map((match) => (
                                    <MatchCard key={match.id} match={match} />
                                ))}
                            </div>
                        </div>

                        <MoreMatches count={rest.length}>
                            {rest.map((match) => (
                                <MatchCard key={match.id} match={match} />
                            ))}
                        </MoreMatches>
                    </>
                )}
            </div>
        </div>
    );
}
