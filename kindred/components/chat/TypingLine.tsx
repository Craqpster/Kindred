"use client";

import type { ChatMember } from "@/lib/chat/types";

/// "Ana is typing…", sitting between the timeline and the composer.
///
/// Always occupies its row, even when nobody is typing. Letting it appear and disappear
/// shifted the composer up and down by a line, which is a jolt right where someone is trying
/// to aim at a text box.
export default function TypingLine({
    typingIds,
    membersById,
}: {
    typingIds: string[];
    membersById: Map<string, ChatMember>;
}) {
    return (
        <p
            className="h-5 px-4 text-label text-ink-600"
            aria-live="polite"
            // Announced only when it says something. Without this a screen reader is told
            // "blank" every time somebody stops typing.
            aria-hidden={typingIds.length === 0}
        >
            {describe(typingIds, membersById)}
        </p>
    );
}

function describe(typingIds: string[], membersById: Map<string, ChatMember>): string {
    // Anyone not in the member list is skipped rather than shown as "Someone": a name we do
    // not have means a member the client has not loaded, and a phantom typist is worse than
    // a missing one.
    const names = typingIds
        .map((id) => membersById.get(id)?.username)
        .filter((name): name is string => !!name);

    if (names.length === 0) return "";
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;

    // Past two, naming everyone makes the line longer than the messages above it.
    return "Several people are typing…";
}
