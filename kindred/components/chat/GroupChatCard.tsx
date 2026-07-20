"use client";

import { useId, useState, useTransition } from "react";
import { useChatContext } from "stream-chat-react";

import { findMyGroup } from "@/app/(app)/chats/actions";
import AvatarGroup from "@/components/chat/AvatarGroup";
import Button from "@/components/ui/Button";
import type { FormGroupFailure, Group } from "@/lib/groups";

const FAILURE_COPY: Record<FormGroupFailure, string> = {
    no_tags: "Add a few interests to your profile first, so we know who to pair you with.",
    not_enough_people: "Not enough people yet — check back soon and we'll find your group.",
    // Someone we picked was grouped a moment earlier. Nothing is wrong; pressing again works.
    race: "Someone beat you to it. Try once more.",
};

const CARD = "rounded-card border border-ink-900/8 bg-surface p-4 shadow-card";

export default function GroupChatCard({ group }: { group: Group | null }) {
    if (!group) return <FindGroup />;
    if (!group.streamChannelId) return <FinishSetup title={group.title} />;
    return <OpenGroup group={group} channelId={group.streamChannelId} />;
}

function OpenGroup({ group, channelId }: { group: Group; channelId: string }) {
    const { client, setActiveChannel } = useChatContext();
    const titleId = useId();

    // Everyone but the viewer: their own face in a group they're already in is noise.
    const others = group.members
        .filter((member) => member.id !== client.userID)
        .map((member) => member.username);

    return (
        <article aria-labelledby={titleId} className={`m-3 flex items-center gap-2.5 ${CARD}`}>
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

function FinishSetup({ title }: { title: string }) {
    const [pending, start] = useTransition();

    return (
        <article className={`m-3 flex items-center gap-2.5 ${CARD}`}>
            <div className="min-w-0 flex-1">
                <p className="truncate text-meta font-medium text-ink-900">{title}</p>
                <p className="text-sm text-ink-600">Still setting up this chat.</p>
            </div>
            <Button
                variant="accent"
                size="sm"
                disabled={pending}
                onClick={() => start(async () => void (await findMyGroup()))}
            >
                {pending ? "Retrying…" : "Retry"}
            </Button>
        </article>
    );
}

function FindGroup() {
    const [pending, start] = useTransition();
    const [failure, setFailure] = useState<FormGroupFailure | null>(null);

    return (
        <article className={`m-3 ${CARD}`}>
            <div className="flex items-center gap-2.5">
                <div className="min-w-0 flex-1">
                    <p className="text-meta font-medium text-ink-900">Find your group</p>
                    <p className="text-sm text-ink-600">A few people who like what you like.</p>
                </div>
                <Button
                    variant="accent"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                        start(async () => {
                            const result = await findMyGroup();
                            setFailure(result.ok ? null : result.reason);
                        })
                    }
                >
                    {pending ? "Looking…" : "Find"}
                </Button>
            </div>

            {failure && (
                <p role="status" className="mt-3 text-sm text-ink-600">
                    {FAILURE_COPY[failure]}
                </p>
            )}
        </article>
    );
}

function formatNames(names: string[]): string {
    return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);
}