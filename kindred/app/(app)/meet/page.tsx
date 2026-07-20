import MatchCard from "@/components/meet/MatchCard";
import MoreMatches from "@/components/meet/MoreMatches";
import SpotlightCard from "@/components/meet/SpotlightCard";
import { requireProfile } from "@/lib/dal";
import { getMatchesFor } from "@/lib/matches";

// How many matches share the opening screen with the spotlight. Everyone else is behind
// "Show more people".
const RUNNERS_UP = 2;

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
        <div className="min-h-full flex-1 bg-canvas font-body text-slate-ink">
            <div className="mx-auto w-full max-w-5xl px-6 py-10">
            {/* Title and subtitle sit on one row on desktop; stacked on mobile, where
                side by side would be too cramped to read. */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h1 className="font-display text-3xl font-semibold tracking-tight">Meet</h1>
                <p className="text-muted">Start with one or two, you can always meet more.</p>
            </div>

            {matches.length === 0 ? (
                <p className="mt-10 rounded-3xl border border-slate-ink/8 bg-surface p-8 text-center text-muted">
                    No matches just yet. As more people join and share your hobbies and
                    interests, they&apos;ll show up here.
                </p>
            ) : (
                <>
                    {/* The spotlight and the two runners-up share one grid so the
                        runners-up stack beside the tall card instead of leaving an
                        empty track next to it. Collapses to a single column on mobile. */}
                    <div className="mt-8 grid gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2 lg:row-span-2">
                            <SpotlightCard match={top} />
                        </div>
                        {runnersUp.map((match) => (
                            <MatchCard key={match.id} match={match} />
                        ))}
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
