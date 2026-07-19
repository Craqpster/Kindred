import { Hand } from "lucide-react";

import { sayHi } from "@/app/(app)/meet/actions";
import ExtraTagsPill from "@/components/meet/ExtraTagsPill";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import type { Match } from "@/lib/matches";
import { tintFor } from "@/lib/tag-colors";

const MAX_PILLS = 3;

// Shared interests lead; the person is context underneath.
export default function MatchCard({ match }: { match: Match }) {
    const shown = match.sharedTags.slice(0, MAX_PILLS);
    const extra = match.sharedTags.slice(MAX_PILLS);

    return (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-ink/8 bg-surface p-5">
            <div className="flex flex-col gap-2.5">
                <p className="text-[11px] tracking-wide text-muted">You both like</p>

                <div className="flex flex-wrap items-center gap-1.5">
                    {shown.map((tag) => {
                        const tint = tintFor(tag);
                        return (
                            <span
                                key={tag}
                                style={{ backgroundColor: tint.bg, color: tint.text }}
                                className="rounded-full px-3 py-1.5 text-sm font-medium"
                            >
                                {tag}
                            </span>
                        );
                    })}
                    <ExtraTagsPill tags={extra} />
                </div>
            </div>

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