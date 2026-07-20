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
export default function SpotlightCard({ match }: { match: Match }) {
    const sharedCount = match.sharedTags.length;
    const reason = match.sharedEaseIn ? EASE_IN_REASON[match.sharedEaseIn] : null;

    return (
        <div className="flex flex-col gap-6 rounded-hero border border-ink-900/8 bg-surface p-7 shadow-hero sm:p-9">
            <p className="text-label text-ink-600 uppercase">Your closest match</p>

            <div className="flex flex-col gap-4">
                <p className="font-display text-hero text-ink-900">
                    You have <span className="text-accent-600">{sharedCount}</span>{" "}
                    {sharedCount === 1 ? "thing" : "things"} in common
                </p>

                {/* No label — the line above already said what these are. */}
                <MatchTags tags={match.sharedTags} max={SHARED_PILLS} />
            </div>

            {reason ? (
                <p className="flex items-start gap-2.5 rounded-card bg-bone-100 p-3.5 text-body text-ink-600">
                    <Sparkles size={16} className="mt-0.5 shrink-0 text-accent-600" aria-hidden />
                    {reason}
                </p>
            ) : null}

            <div className="mt-auto flex flex-col gap-5 border-t border-bone-200 pt-6">
                <div className="flex items-center gap-3">
                    <Avatar name={match.username} size={44} />

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <h2 className="truncate font-display text-title text-ink-900">
                            {match.username}
                        </h2>
                        {match.otherTags.length > 0 ? (
                            <p className="truncate text-meta text-ink-600">
                                Also into {match.otherTags.slice(0, ALSO_INTO).join(", ")}
                            </p>
                        ) : null}
                    </div>
                </div>

                <SayHiButton id={match.id} full />
            </div>
        </div>
    );
}