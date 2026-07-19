import MatchCard from "@/components/meet/MatchCard";
import { requireProfile } from "@/lib/dal";
import { getMatchesFor } from "@/lib/matches";

// Groups are deferred (no formation mechanism yet), so this shows only the 1:1 section.
export default async function MeetPage() {
    const profile = await requireProfile();
    const matches = await getMatchesFor(profile);

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
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {matches.map((match) => (
                        <MatchCard key={match.id} match={match} />
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}
