import Link from "next/link";

import MatchTags from "@/components/meet/MatchTags";
import SayHiButton from "@/components/meet/SayHiButton";
import Avatar from "@/components/ui/Avatar";
import type { Match } from "@/lib/matches";

const MAX_PILLS = 3;
export default function MatchCard({ match }: { match: Match }) {
    return (
        <div className="flex h-full flex-col gap-4 rounded-card border border-ink-900/8 bg-surface p-5 shadow-card transition-[translate,box-shadow] duration-250 ease-smooth hover:shadow-hero motion-safe:hover:-translate-y-px">
            <MatchTags tags={match.sharedTags} max={MAX_PILLS} label="You both like" />
            <div className="mt-auto flex items-center gap-2.5 pt-4">
                {/* The face and the name open the profile; the button stays its own control.
                    Deliberately not the whole card — Say hi sits inside it, and a link
                    wrapping a button is both invalid and a good way to greet someone you only
                    meant to read about. */}
                <Link
                    href={`/u/${match.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
                >
                    <Avatar name={match.username} size={28} />
                    {/* ink-900, not muted: the name is the person's identity, not metadata,
                        and ink-600 at this size is borderline against white. */}
                    <h3 className="min-w-0 flex-1 truncate text-meta font-medium text-ink-900">
                        {match.username}
                    </h3>
                </Link>

                <SayHiButton id={match.id} />
            </div>
        </div>
    );
}