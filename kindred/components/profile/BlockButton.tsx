"use client";

import { Ban } from "lucide-react";
import { useState } from "react";

import { blockUser } from "@/app/(app)/u/actions";

/// Blocks the person whose profile this is.
///
/// Confirms first, inline. Blocking is not destructive in the sense that a delete is — it can
/// be undone from your own profile — but it makes a conversation disappear for both people,
/// and that is enough of a surprise to be worth one deliberate tap.
///
/// Quiet by default: an outlined button in muted ink rather than anything red. Someone reading
/// a stranger's profile is usually just curious, and a prominent danger button on every profile
/// sets a tone this app is specifically trying not to set.
export default function BlockButton({
    profileId,
    username,
}: {
    profileId: string;
    username: string;
}) {
    const [confirming, setConfirming] = useState(false);

    if (!confirming) {
        return (
            <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-bone-300 px-3 py-1.5 text-label text-ink-600 transition-colors hover:border-ink-900/20 hover:text-ink-900"
            >
                <Ban size={13} strokeWidth={1.5} aria-hidden />
                Block
            </button>
        );
    }

    return (
        <div className="flex flex-col items-center gap-2 rounded-card border border-bone-300 bg-surface p-3 text-center">
            <p className="text-meta text-ink-900">Block {username}?</p>
            <p className="max-w-xs text-label text-ink-600">
                You will not see each other on Meet, and any conversation you share disappears
                for both of you. They are not told. You can undo this from your own profile.
            </p>

            <div className="mt-1 flex items-center gap-2">
                {/* A form rather than an onClick: the action runs on the server, and a form
                    submits without JavaScript having to have loaded. */}
                <form action={blockUser}>
                    <input type="hidden" name="profile_id" value={profileId} />
                    <button
                        type="submit"
                        className="cursor-pointer rounded-full bg-ink-900 px-3.5 py-1.5 text-label font-medium text-surface transition-colors hover:bg-ink-900/85"
                    >
                        Block
                    </button>
                </form>

                <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="cursor-pointer rounded-full px-3 py-1.5 text-label text-ink-600 transition-colors hover:text-ink-900"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
