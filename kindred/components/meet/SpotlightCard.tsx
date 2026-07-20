import MatchTags from "@/components/meet/MatchTags";
import SayHiButton from "@/components/meet/SayHiButton";
import Avatar from "@/components/ui/Avatar";
// import { EASE_IN_REASON } from "@/lib/ease-in";
import type { Match } from "@/lib/matches";

const SHARED_PILLS = 6;
const ALSO_INTO = 3;

export default function SpotlightCard({ match }: { match: Match }) {
    const sharedCount = match.sharedTags.length;
    // const reason = match.sharedEaseIn ? EASE_IN_REASON[match.sharedEaseIn] : null;

    return (
        <div className="flex flex-col overflow-hidden rounded-hero bg-surface shadow-card transition-[translate,box-shadow] duration-250 ease-smooth hover:shadow-hero motion-safe:hover:-translate-y-px">
            
            <div className="flex flex-col items-start gap-6 p-8 sm:px-10 sm:py-8">
                <div className="flex flex-col gap-4">
                    <p className="font-display text-hero text-ink-900">
                        You share <span className="text-accent-600">{sharedCount}</span>{" "}
                        {sharedCount === 1 ? "interest" : "interests"}
                    </p>

                    <div className="pt-1">
                        <MatchTags tags={match.sharedTags} max={SHARED_PILLS} />
                    </div>
                </div>
            </div>

            <div className="mt-auto flex items-center gap-3 bg-bone-100/70 p-5 sm:px-10 sm:py-5">
                <Avatar name={match.username} size={48} />

                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                    <h2 className="truncate font-display text-title text-ink-900">
                        {match.username}
                    </h2>

                    {match.otherTags.length > 0 ? (
                        <p className="truncate text-meta text-ink-600">
                            Also into {match.otherTags.slice(0, ALSO_INTO).join(", ")}
                        </p>
                    ) : null}
                </div>

                <div className="shrink-0 pl-2">
                    <SayHiButton id={match.id} labelled />
                </div>
            </div>
        </div>
    );
}