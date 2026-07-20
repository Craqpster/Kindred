import MatchCard from "@/components/meet/MatchCard";
import MoreMatches from "@/components/meet/MoreMatches";
import SpotlightCard from "@/components/meet/SpotlightCard";
import { requireProfile } from "@/lib/dal";
import { getMatchesFor } from "@/lib/matches";

// How many matches share the opening screen with the spotlight. Everyone else is behind
const RUNNERS_UP = 3;

// Groups are deferred (no formation mechanism yet), so this shows only the 1:1 section.
//
// The page leads with one match rather than laying all ten out at once. getMatchesFor
// already ranks them, so an even grid was throwing that ordering away and asking the
// user to size up ten strangers in one go. One person, explained properly, is a smaller
// ask — and the rest are one click away rather than gone.
export default async function MeetPage() {
    const profile = await requireProfile();
    const matches = await getMatchesFor(profile);

    const [top, ...others] = matches;
    const runnersUp = others.slice(0, RUNNERS_UP);
    const rest = others.slice(RUNNERS_UP);

    return (
        <div className="min-h-full flex-1 bg-bone-100 font-body text-ink-900">
            <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12">
                <h1 className="font-display text-title">Meet</h1>
                <p className="mt-1 text-body text-ink-600">
                    Start with one or two, you can always meet more.
                </p>

                {matches.length === 0 ? (
                    <p className="mt-10 rounded-hero border border-ink-900/8 bg-surface p-10 text-center text-body text-ink-600 shadow-card">
                        No matches just yet. As more people join and share your hobbies and
                        interests, they&apos;ll show up here.
                    </p>
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
