import { sayHi, notNow } from "@/app/(app)/meet/actions";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { easeInPhrase } from "@/lib/ease-in";
import type { Match } from "@/lib/matches";
import { openerFor } from "@/lib/openers";

// `viewerEaseIn` is the current user's ease_in value, used only to phrase the shared line
// ("you both ...")
export default function MatchCard({
    match,
    viewerEaseIn,
}: {
    match: Match;
    viewerEaseIn: string | null;
}) {
    const topTag = match.sharedTags[0];
    const sharedPhrase = match.sharedEaseIn ? easeInPhrase(viewerEaseIn) : null;

    return (
        <div className="flex flex-col gap-4 rounded-3xl border border-metro-blue/20 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
                <Avatar name={match.username} size={44} />
                <span className="font-semibold text-star-sapphire">{match.username}</span>
            </div>

            <p className="text-sm text-gray-600">
                <span className="font-medium text-ink">Why you matched:</span>{" "}
                {topTag ? (
                    <>
                        you both love {topTag}
                        {sharedPhrase ? <> and both {sharedPhrase}</> : null}.
                    </>
                ) : (
                    <>you both {sharedPhrase ?? "seem like a good fit"}.</>
                )}
            </p>

            <p className="rounded-2xl bg-mist px-4 py-3 text-sm text-star-sapphire italic">
                {openerLine(topTag)}
            </p>

            <div className="flex gap-2">
                <form action={sayHi} className="flex-1">
                    <input type="hidden" name="other_id" value={match.id} />
                    <Button type="submit" className="w-full">
                        Say hi
                    </Button>
                </form>
                <form action={notNow} className="flex-1">
                    <input type="hidden" name="other_id" value={match.id} />
                    <Button type="submit" variant="secondary" className="w-full">
                        Not now
                    </Button>
                </form>
            </div>
        </div>
    );
}

function openerLine(topTag: string | undefined): string {
    return `${openerFor(topTag)}.`;
}