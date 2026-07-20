"use client";

import { useId } from "react";
import { useChatContext } from "stream-chat-react";

import AvatarGroup from "@/components/chat/AvatarGroup";
import Button from "@/components/ui/Button";
import type { Group } from "@/lib/groups";

/// The group chat, pinned above the Active list. Finding a group happens on /meet — by the
/// time this renders there is a channel to open, so it has only the one state.
///
/// channelId is separate from `group` rather than read off it because group.streamChannelId
/// is nullable while the channel is still being created; taking it as its own required prop
/// makes the caller prove there is one instead of asserting it away here.
export default function GroupChatRow({
    group,
    channelId,
}: {
    group: Group;
    channelId: string;
}) {
    const { client, setActiveChannel } = useChatContext();
    const titleId = useId();

    // Everyone but the viewer: their own face in a group they're already in is noise.
    const others = group.members
        .filter((member) => member.id !== client.userID)
        .map((member) => member.username);

    return (
        <article
            aria-labelledby={titleId}
            className="m-3 flex items-center gap-2.5 rounded-card border border-ink-900/8 bg-surface p-4 shadow-card"
        >
            <AvatarGroup names={others} />

            <h2 id={titleId} className="min-w-0 flex-1 truncate text-meta font-medium text-ink-900">
                {group.title}
                {/* The avatars are decorative, so the roster has to reach a screen reader
                    some other way. Inside the heading so it lands in the accessible name
                    rather than trailing after it as loose text. */}
                <span className="sr-only"> group with {formatNames(others)}</span>
            </h2>

            <Button
                variant="accent"
                size="sm"
                aria-label={`Open ${group.title} group chat`}
                // client.channel() sets cid synchronously, and <Channel> watches whatever
                // it receives from context — it keys on channel.cid and calls watch()
                // itself when the channel isn't initialised. Calling watch() here as well
                // would only add a floating promise.
                onClick={() => setActiveChannel(client.channel("team", channelId))}
            >
                Open group
            </Button>
        </article>
    );
}

function formatNames(names: string[]): string {
    return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);
}