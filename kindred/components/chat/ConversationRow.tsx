"use client";

import AvatarGroup from "@/components/chat/AvatarGroup";
import Avatar from "@/components/ui/Avatar";
import CountBadge from "@/components/ui/CountBadge";
import type { ChatConversation } from "@/lib/chat/types";

/// One conversation in the list — a DM or a group, told apart by kind.
///
/// The whole row is the button, so there is no separate "open" affordance: tapping the card
/// opens it, the way a DM list works everywhere else.
export default function ConversationRow({
    conversation,
    selected,
    onOpen,
}: {
    conversation: ChatConversation;
    selected: boolean;
    onOpen: (conversationId: string) => void;
}) {
    const { others, unreadCount } = conversation;
    const isGroup = conversation.kind === "group";

    return (
        <button
            type="button"
            onClick={() => onOpen(conversation.id)}
            aria-current={selected ? "true" : undefined}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-card p-3 text-left transition-colors ${
                selected ? "bg-surface" : "hover:bg-surface/60"
            }`}
        >
            {isGroup ? (
                <AvatarGroup users={others.map((m) => ({ name: m.username }))} size={40} />
            ) : (
                <Avatar
                    name={conversation.title}
                    avatarId={others[0]?.avatarId ?? undefined}
                    avatarSeed={others[0]?.avatarSeed ?? undefined}
                    size={40}
                />
            )}

            <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-meta font-medium text-ink-900">
                        {conversation.title}
                    </span>
                    {conversation.lastMessageAt && (
                        <time
                            dateTime={conversation.lastMessageAt}
                            className="shrink-0 text-label text-ink-600"
                        >
                            {formatWhen(conversation.lastMessageAt)}
                        </time>
                    )}
                </span>

                <span
                    className={`mt-0.5 block truncate text-sm ${
                        unreadCount > 0 ? "font-medium text-ink-900" : "text-ink-600"
                    }`}
                >
                    {conversation.awaitingYou
                        ? "Wants to say hi"
                        : (conversation.preview ?? "No messages yet")}
                </span>
            </span>

            {unreadCount > 0 && (
                <>
                    <CountBadge
                        count={unreadCount}
                        className="ml-1 text-surface"
                        circleClassName="bg-accent-600"
                    />
                    <span className="sr-only">
                        {unreadCount} unread {unreadCount === 1 ? "message" : "messages"}
                    </span>
                </>
            )}
        </button>
    );
}

/// Time today, weekday this week, date beyond that — the usual DM-list shorthand.
function formatWhen(iso: string): string {
    const date = new Date(iso);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }

    const daysAgo = (now.getTime() - date.getTime()) / 86_400_000;
    if (daysAgo < 7) return date.toLocaleDateString(undefined, { weekday: "short" });

    return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}
