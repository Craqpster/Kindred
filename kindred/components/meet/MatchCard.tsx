import MatchTags from "@/components/meet/MatchTags";
import SayHiButton from "@/components/meet/SayHiButton";
import Avatar from "@/components/ui/Avatar";
import type { Match } from "@/lib/matches";

const MAX_PILLS = 3;
export default function MatchCard({ match }: { match: Match }) {
    return (
        <div className="flex h-full flex-col gap-4 rounded-card border border-ink-900/8 bg-surface p-5 shadow-card transition-[translate,box-shadow] duration-250 ease-spring hover:shadow-hero motion-safe:hover:-translate-y-0.5">
            <MatchTags tags={match.sharedTags} max={MAX_PILLS} label="You both like" />
            <div className="mt-auto flex items-center gap-2.5 pt-4">
                <Avatar name={match.username} size={28} />
                {/* ink-900, not muted: the name is the person's identity, not metadata,
                    and ink-600 at this size is borderline against white. */}
                <h3 className="min-w-0 flex-1 truncate text-meta font-medium text-ink-900">
                    {match.username}
                </h3>

                <SayHiButton id={match.id} />
            </div>
        </div>
    );
}