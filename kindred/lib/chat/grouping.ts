// How a flat list of messages becomes something that reads like a conversation.
//
// Three decisions, all of them about time rather than content, which is why they live here
// rather than inside a component:
//
//   * where a new day starts, so a timeline has landmarks instead of scrolling forever;
//   * where one person's turn ends and the next begins;
//   * which message in a turn carries the timestamp.
//
// The alternative — a name, a face and a time on every single line — is what makes a chat
// feel like a log file.

import type { ChatMessage } from "@/lib/chat/types";

/// Long enough that a normal back-and-forth stays one turn, short enough that picking a
/// conversation back up after lunch reads as a new one.
const RUN_BREAKS_AFTER_MS = 5 * 60 * 1000;

function sameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/// Whether a date separator belongs above this message.
export function startsNewDay(message: ChatMessage, previous?: ChatMessage): boolean {
    if (!previous) return true;
    return !sameDay(new Date(previous.createdAt), new Date(message.createdAt));
}

/// Whether this message begins a new turn — a different person, a long enough pause, or a
/// new day. The first message of a turn is the one that shows a name and a face.
export function startsNewRun(message: ChatMessage, previous?: ChatMessage): boolean {
    if (!previous) return true;
    if (previous.sender?.id !== message.sender?.id) return true;
    if (startsNewDay(message, previous)) return true;

    const gap = new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime();
    return gap > RUN_BREAKS_AFTER_MS;
}

/// Whether this message ends a turn. The last message of a turn is the one that carries the
/// timestamp and the rounded-off corner, so a run reads as one block with one time on it.
export function endsRun(message: ChatMessage, next?: ChatMessage): boolean {
    if (!next) return true;
    return startsNewRun(next, message);
}

/// "Today", "Yesterday", or a date. Relative for the two days people actually think in, and
/// absolute past that, because "5 days ago" is a worse answer than "Thu, 23 Jul".
export function dayLabel(iso: string): string {
    const date = new Date(iso);
    const now = new Date();

    if (sameDay(date, now)) return "Today";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay(date, yesterday)) return "Yesterday";

    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(sameYear ? {} : { year: "numeric" }),
    });
}

/// The clock time on a message. Locale-aware, so a 24-hour region gets 14:05 rather than an
/// Americanism.
export function clockTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
