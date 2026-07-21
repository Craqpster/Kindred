"use client";

import { useState, useTransition } from "react";

import { findMyGroup } from "@/app/(app)/meet/actions";
import Button from "@/components/ui/Button";
import type { FormGroupFailure, Group } from "@/lib/groups";

const FAILURE_COPY: Record<FormGroupFailure, string> = {
    no_tags: "Add a few interests to your profile first, so we know who to pair you with.",
    not_enough_people: "Not enough people yet — check back soon and we'll find your group.",
    // Someone we picked was grouped a moment earlier. Nothing is wrong; pressing again works.
    race: "Someone beat you to it. Try once more.",
};

const CARD = "mt-8 rounded-card border border-ink-900/8 bg-surface p-4 shadow-card";

/// Finding a group lives on /meet; opening one lives on /chats. So this renders nothing
/// once the group has a channel — there is nothing left to find, and the group itself is
/// pinned to the Active tab over there.
export default function FindGroupCard({ group }: { group: Group | null }) {
    if (!group) return <FindGroup />;
    if (!group.streamChannelId) return <FinishSetup title={group.title} />;
    return null;
}

function FindGroup() {
    const [pending, start] = useTransition();
    const [failure, setFailure] = useState<FormGroupFailure | null>(null);

    return (
        <article className={CARD}>
            <div className="flex items-center gap-2.5">
                <div className="min-w-0 flex-1">
                    <p className="text-meta font-medium text-ink-900">Find your group</p>
                    <p className="text-sm text-ink-600">
                        A few people who like what you like.
                    </p>
                </div>
                <Button
                    variant="accent"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                        start(async () => {
                            // Success redirects into the group chat and never returns a
                            // value, so a result here always means something went wrong.
                            const result = await findMyGroup();
                            if (result) setFailure(result.reason);
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

/// The group exists in Postgres but its Stream channel never got created — see the repair
/// path in findMyGroup. Retrying finishes the job rather than forming a second group.
function FinishSetup({ title }: { title: string }) {
    const [pending, start] = useTransition();

    return (
        <article className={`flex items-center gap-2.5 ${CARD}`}>
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