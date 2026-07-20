import MatchTags from "@/components/meet/MatchTags";
import SayHiButton from "@/components/meet/SayHiButton";
import Avatar from "@/components/ui/Avatar";
import type { Match } from "@/lib/matches";

const MAX_PILLS = 3;

// Shared interests lead; the person is context underneath.
export default function MatchCard({ match }: { match: Match }) {
    return (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-ink/8 bg-surface p-5">
            <MatchTags tags={match.sharedTags} max={MAX_PILLS} label="You both like" />

            <div className="mt-auto flex items-center gap-2.5 pt-4">
                <Avatar name={match.username} size={28} />
                <h3 className="min-w-0 flex-1 truncate text-sm font-normal text-muted">
                    {match.username}
                </h3>

                <SayHiButton id={match.id} />
            </div>
        </div>
    );
}