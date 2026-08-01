"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/// Pulls the match list again without leaving the page.
///
/// /meet is a server component, so the list is whatever it was when the page rendered.
/// Someone signing up while you sit there, or filling in the hobbies that would match you,
/// does not reach you until something re-runs the query — and until now the only way to do
/// that was to navigate away and back.
///
/// router.refresh() rather than a server action: there is nothing to mutate here, only
/// something to re-read. It re-runs the page on the server and reconciles the result into
/// the existing tree, so the view toggle and any open "more matches" panel stay as they were.
///
/// Worth knowing what this does NOT do: someone you have already said hi to stays gone.
/// getMatchesFor excludes everyone you have a connections row with, so refreshing shows you
/// new people, never the same people again.
export default function RefreshMatches() {
    const router = useRouter();
    const [refreshing, startRefreshing] = useTransition();

    return (
        <button
            type="button"
            onClick={() => startRefreshing(() => router.refresh())}
            disabled={refreshing}
            aria-label="Look for new matches"
            title="Look for new matches"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink-900/8 bg-surface text-ink-900 shadow-sm transition-[translate,box-shadow,background-color] hover:-translate-y-px hover:bg-bone-100 hover:shadow-card active:translate-y-0 active:shadow-sm disabled:cursor-default disabled:opacity-60"
        >
            <RotateCw
                size={16}
                strokeWidth={1.5}
                aria-hidden
                className={refreshing ? "animate-spin" : undefined}
            />
        </button>
    );
}
