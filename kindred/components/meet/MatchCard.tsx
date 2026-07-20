import { Hand } from "lucide-react";

import { sayHi } from "@/app/(app)/meet/actions";
import MatchTags from "@/components/meet/MatchTags";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import type { Match } from "@/lib/matches";

const MAX_PILLS = 3;

// Shared interests lead; the person is context underneath.
export default function MatchCard({ match }: { match: Match }) {
    return (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-ink/8 bg-surface p-5">
            <MatchTags tags={match.sharedTags} max={MAX_PILLS} label="You both like" />

            <div className="mt-auto flex items-center gap-2.5 pt-4">
                <Avatar name={match.username} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {match.username}
                </span>

                <form action={sayHi}>
                    <input type="hidden" name="other_id" value={match.id} />
                    {/* Icon-only, so it needs an explicit accessible name. */}
                    <Button
                        type="submit"
                        size="icon"
                        aria-label={`Say hi to ${match.username}`}
                        title="Say hi"
                        className="bg-accent hover:bg-accent/90"
                    >
                        <Hand size={18} aria-hidden />
                    </Button>
                </form>
            </div>
        </div>
    );
}