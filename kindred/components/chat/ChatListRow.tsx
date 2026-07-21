"use client";

import { useEffect, useState } from "react";
import type { Channel } from "stream-chat";
import {
    getLatestMessagePreviewText,
    useChatContext,
    useTranslationContext,
} from "stream-chat-react";

import AvatarGroup from "@/components/chat/AvatarGroup";
import Avatar from "@/components/ui/Avatar";

/// One conversation in the list — a 1:1 or a group, told apart by channel type.
///
/// The whole row is the button, so there is no separate "open" affordance: tapping the card
/// opens it, the way a DM list works everywhere else.
export default function ChatListRow({ channel }: { channel: Channel }) {
    const { client, channel: activeChannel, setActiveChannel } = useChatContext();
    const { t, userLanguage } = useTranslationContext();

    const unread = useUnreadCount(channel);

    const isGroup = channel.type === "team";
    const selected = activeChannel?.cid === channel.cid;

    // Names come from Stream — startChatRequest and createGroupChannel both upsert users with
    // name set to the username — so a row needs no Postgres round-trip.
    const others = Object.values(channel.state.members)
        .filter((member) => (member.user_id ?? member.user?.id) !== client.userID)
        .map((member) => member.user?.name ?? member.user?.id ?? "?");

    const title = isGroup ? (channel.data?.name ?? "Group") : (others[0] ?? "Unknown");
    const preview = getLatestMessagePreviewText(channel, t, userLanguage);
    // Already a Date here, unlike the ISO string on channel.data.
    const lastAt = channel.state.last_message_at;

    return (
        <button
            type="button"
            onClick={() => setActiveChannel(channel)}
            aria-current={selected ? "true" : undefined}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-card p-3 text-left transition-colors ${
                selected ? "bg-surface" : "hover:bg-surface/60"
            }`}
        >
            {isGroup ? (
                <AvatarGroup names={others} size={40} />
            ) : (
                <Avatar name={title} size={40} />
            )}

            <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-meta font-medium text-ink-900">
                        {title}
                    </span>
                    {lastAt && (
                        <time
                            dateTime={lastAt.toISOString()}
                            className="shrink-0 text-label text-ink-600"
                        >
                            {formatWhen(lastAt)}
                        </time>
                    )}
                </span>

                <span
                    className={`mt-0.5 block truncate text-sm ${
                        unread ? "font-medium text-ink-900" : "text-ink-600"
                    }`}
                >
                    {preview || "No messages yet"}
                </span>
            </span>

            {unread > 0 && (
                <>
                    <span
                        aria-hidden="true"
                        className="ml-1 shrink-0 rounded-full bg-accent-600 px-1.5 text-label text-surface tabular-nums"
                    >
                        {unread}
                    </span>
                    <span className="sr-only">
                        {unread} unread {unread === 1 ? "message" : "messages"}
                    </span>
                </>
            )}
        </button>
    );
}

/// Per-channel unread, kept live.
///
/// The channel list only re-renders when it reorders, so without this a badge would sit
/// stale on a row that is already at the top. stream-chat-react has a useSelectedChannelState
/// hook that does exactly this, but it isn't exported from the package root, so this
/// subscribes to the same three events directly.
function useUnreadCount(channel: Channel): number {
    const [unread, setUnread] = useState(() => channel.countUnread());

    useEffect(() => {
        const update = () => setUnread(channel.countUnread());
        // The channel identity can change under us; re-read rather than trust the initial
        // useState, which only ran for the first channel this row ever rendered.
        update();

        const subscriptions = [
            channel.on("message.new", update),
            channel.on("message.read", update),
            channel.on("notification.mark_read", update),
        ];
        return () => subscriptions.forEach((subscription) => subscription.unsubscribe());
    }, [channel]);

    return unread;
}

/// Time today, weekday this week, date beyond that — the usual DM-list shorthand.
function formatWhen(date: Date): string {
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
        return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }

    const daysAgo = (now.getTime() - date.getTime()) / 86_400_000;
    if (daysAgo < 7) return date.toLocaleDateString(undefined, { weekday: "short" });

    return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}
