import { Hand } from "lucide-react";

import { sayHi } from "@/app/(app)/meet/actions";
import ExtraTagsPill from "@/components/meet/ExtraTagsPill";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import type { Match } from "@/lib/matches";

const MAX_PILLS = 3;

export default function MatchCard({ match }: { match: Match }) {
    const shown = match.sharedTags.slice(0, MAX_PILLS);
    const extra = match.sharedTags.slice(MAX_PILLS);

    return (
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <Avatar name={match.username} size={44} />
                <span className="font-semibold text-star-sapphire">{match.username}</span>
            </div>

            {shown.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {shown.map((tag) => (
                        <span
                            key={tag}
                            className="rounded-full bg-iceland/10 px-3 py-1 text-xs text-star-sapphire"
                        >
                            {tag}
                        </span>
                    ))}
                    <ExtraTagsPill tags={extra} />
                </div>
            )}

            <div className="mt-auto flex gap-2">
                <form action={sayHi}>
                    <input type="hidden" name="other_id" value={match.id} />
                    {/* Icon-only, so it needs an explicit accessible name. */}
                    <Button type="submit" size="icon" aria-label="Say hi" title="Say hi">
                        <Hand size={18} aria-hidden />
                    </Button>
                </form>
            </div>
        </div>
    );
}