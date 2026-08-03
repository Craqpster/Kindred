import { Ban } from "lucide-react";

import { unblockUser } from "@/app/(app)/u/actions";
import Avatar from "@/components/ui/Avatar";

type Blocked = {
    id: string;
    username: string;
    avatarId: string | null;
    avatarSeed: string | null;
    blockedAt: string;
};

/// The people you have blocked, and the only place to undo it.
///
/// Rendered even when empty. A blocked list that only appears once you have used it is one
/// nobody discovers, and "block is reversible" is a thing worth knowing *before* you block
/// somebody rather than after.
///
/// Only your own blocks: lib/blocks.ts scopes the query to rows you created, because a block
/// somebody placed on you is not yours to lift and not yours to see.
export default function BlockedList({ blocked }: { blocked: Blocked[] }) {
    return (
        <section>
            <h2 className="font-display text-xl font-bold text-star-sapphire">Blocked</h2>
            <p className="mt-1 text-sm text-star-sapphire/70">
                You will not see each other on Meet, and any conversation you share is hidden
                from you both. They are not told.
            </p>

            {blocked.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-meta text-ink-600">
                    <Ban size={14} strokeWidth={1.5} aria-hidden />
                    You have not blocked anyone.
                </p>
            ) : (
                <ul className="mt-4 flex flex-col gap-2">
                    {blocked.map((person) => (
                        <li
                            key={person.id}
                            className="flex items-center gap-3 rounded-card border border-ink-900/8 bg-surface p-3"
                        >
                            {/* Not a link. Their profile refuses to load while blocked, so
                                offering one would be a dead end. */}
                            <Avatar
                                name={person.username}
                                avatarId={person.avatarId ?? undefined}
                                avatarSeed={person.avatarSeed ?? undefined}
                                size={36}
                            />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-meta font-medium text-ink-900">
                                    {person.username}
                                </p>
                                <p className="text-label text-ink-600">
                                    Blocked {formatWhen(person.blockedAt)}
                                </p>
                            </div>

                            <form action={unblockUser}>
                                <input type="hidden" name="profile_id" value={person.id} />
                                <button
                                    type="submit"
                                    className="cursor-pointer rounded-full border border-bone-300 px-3 py-1.5 text-label text-ink-600 transition-colors hover:border-ink-900/20 hover:text-ink-900"
                                >
                                    Unblock
                                </button>
                            </form>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/// Deliberately vague past a week. The exact minute somebody was blocked is not information
/// anyone needs, and a precise timestamp invites reading meaning into it.
function formatWhen(iso: string): string {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return "a few weeks ago";
    return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
