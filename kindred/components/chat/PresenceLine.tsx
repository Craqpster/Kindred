"use client";

import type { PresenceStatus } from "@/components/chat/useConversationChannel";

/// Where the other person is, under their name.
///
/// Three states rather than "green or nothing", and none of them claims more than the channel
/// actually knows — see PresenceStatus for why "away" is not "offline".
const COPY: Record<PresenceStatus, { label: string; dot: string }> = {
    // Filled and coloured: the only one worth drawing attention to.
    active: { label: "Active now", dot: "bg-accent-600" },
    // Filled but muted — present, not paying attention.
    idle: { label: "Idle", dot: "bg-ink-600/50" },
    // Hollow, because it is an absence. A filled grey dot reads as a state someone is in;
    // an outline reads as nobody being there, which is what it means.
    away: { label: "Away", dot: "border border-ink-600/40" },
};

export default function PresenceLine({ status }: { status: PresenceStatus }) {
    const { label, dot } = COPY[status];

    return (
        <p className="flex items-center gap-1.5 text-meta text-ink-600">
            <span className={`size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
            {label}
        </p>
    );
}

/// Stands in for a presence line while the socket is away.
///
/// Presence is only ever as current as the connection carrying it. Leaving "Active now" on
/// screen through a dropped socket states something nobody actually knows — and it is the
/// most misleading thing on the page to get wrong, because "they are here and not replying"
/// is precisely the reading this app exists to avoid. Says what is true instead.
export function ReconnectingLine() {
    return (
        <p className="flex items-center gap-1.5 text-meta text-ink-600">
            <span
                className="size-2.5 shrink-0 animate-pulse rounded-full bg-ink-600/40"
                aria-hidden
            />
            Reconnecting…
        </p>
    );
}

/// A group has several people in several states, so one line has to summarise them. Reports
/// only what is worth acting on: how many are here now.
export function GroupPresenceLine({ activeCount }: { activeCount: number }) {
    return (
        <p className="flex items-center gap-1.5 text-meta text-ink-600">
            <span
                className={`size-2.5 shrink-0 rounded-full ${
                    activeCount > 0 ? "bg-accent-600" : "border border-ink-600/40"
                }`}
                aria-hidden
            />
            {activeCount > 0 ? `${activeCount} active now` : "Nobody here right now"}
        </p>
    );
}
