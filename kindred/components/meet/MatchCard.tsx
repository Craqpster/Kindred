import { sayHi, notNow } from "@/app/(app)/meet/actions";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import type { Match } from "@/lib/matches";

const MAX_PILLS = 3;

export default function MatchCard({ match }: { match: Match }) {
    const shown = match.sharedTags.slice(0, MAX_PILLS);
    const extra = match.sharedTags.length - shown.length;

    return (
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <Avatar name={match.username} size={44} />
                <span className="font-semibold text-star-sapphire">{match.username}</span>
            </div>

            {shown.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {shown.map((tag) => (
                        <span
                            key={tag}
                            className="rounded-full bg-iceland/10 px-3 py-1 text-xs text-star-sapphire"
                        >
                            {tag}
                        </span>
                    ))}
                    {extra > 0 && (
                        <span className="rounded-full bg-iceland/10 px-3 py-1 text-xs text-gray-600">
                            +{extra}
                        </span>
                    )}
                </div>
            )}

            <div className="flex gap-2">
                <form action={sayHi}>
                    <input type="hidden" name="other_id" value={match.id} />
                    <Button type="submit" size="sm">
                        Say hi
                    </Button>
                </form>
                <form action={notNow}>
                    <input type="hidden" name="other_id" value={match.id} />
                    <Button type="submit" variant="secondary" size="sm">
                        Not now
                    </Button>
                </form>
            </div>
        </div>
    );
}
