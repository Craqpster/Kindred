import { Sparkles } from "lucide-react";

import MatchTags from "@/components/meet/MatchTags";
import SayHiButton from "@/components/meet/SayHiButton";
import Avatar from "@/components/ui/Avatar";
import { EASE_IN_REASON } from "@/lib/ease-in";
import type { Match } from "@/lib/matches";

const SHARED_PILLS = 6;

// Capped and truncated so a tag-heavy profile cannot wrap this into a second block and
// unbalance the row it sits in.
const ALSO_INTO = 3;

// The one match the page leads with. getMatchesFor already sorts by overlap, so the
// first entry genuinely is the strongest — this card exists to say so out loud, since
// a grid of equal cards hides the ranking entirely.
//
// It shows no age, no gender and no photo. Both are a field away, but avatar + name +
// age is the shape of a dating profile, and neither answers "why did we match?" — which
// is the only question this card is trying to settle.
export default function SpotlightCard({ match }: { match: Match }) {
    const sharedCount = match.sharedTags.length;
    const reason = match.sharedEaseIn ? EASE_IN_REASON[match.sharedEaseIn] : null;

    return (
        // min-h floors the card so a thin match — one shared tag, no ease-in — still
        // reads as deliberate rather than as a card that failed to load.
        <div className="flex min-h-[18rem] flex-col gap-5 rounded-[2rem] border border-slate-ink/8 bg-surface p-7 sm:p-8">
            <div className="flex flex-col gap-4">
                <p className="text-[11px] tracking-wide text-muted">Your closest match</p>

                <div className="flex items-center gap-3">
                    <Avatar name={match.username} size={48} />
                    <h2 className="min-w-0 truncate font-display text-2xl font-semibold tracking-tight">
                        {match.username}
                    </h2>
                </div>

                {/* The headline does the work that padding otherwise would: it is the
                    reason this person is first, stated at a size you cannot miss. */}
                <p className="font-display text-xl font-medium">
                    You have {sharedCount} {sharedCount === 1 ? "thing" : "things"} in common
                </p>
            </div>

            <MatchTags tags={match.sharedTags} max={SHARED_PILLS} />

            {reason ? (
                <p className="flex items-center gap-2.5 rounded-2xl bg-canvas p-3 text-sm text-muted">
                    <Sparkles size={16} className="shrink-0 text-accent" aria-hidden />
                    {reason}
                </p>
            ) : null}

            {match.otherTags.length > 0 ? (
                <p className="truncate text-meta text-ink-600">
                    Also into {match.otherTags.slice(0, ALSO_INTO).join(", ")}
                </p>
            ) : null}

            {/* mt-auto pins the action to the bottom however much the card above it
                fills, so the button sits in the same place on every match. */}
            <div className="mt-auto pt-1">
                <SayHiButton id={match.id} full />
            </div>
        </div>
    );
}