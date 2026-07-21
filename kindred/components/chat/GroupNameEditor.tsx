"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { renameGroup } from "@/app/(app)/chats/actions";

// Stream's own cap on a channel name, mirrored here so the input stops at the same place
// the server would reject.
const MAX_NAME = 255;

/// The group's name, editable in place at the top of the channel popover.
///
/// Lives here rather than in the pill: the popover already lists everyone in the chat, so
/// it is the group-info panel, and the pill is a floating chip with no room for an input
/// that changes its width.
///
/// Groups only. A 1:1's title is the other person's name and is not ours to change - the
/// caller decides that; this component assumes it has been asked for a group.
export default function GroupNameEditor({
    channelId,
    name,
}: {
    channelId: string;
    name: string;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(name);
    const [pending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);

    // Opening the editor should put the caret in it - the click that opened it was already
    // the decision to rename.
    useEffect(() => {
        if (editing) inputRef.current?.select();
    }, [editing]);

    const save = () => {
        const trimmed = draft.trim();
        // Nothing to do, and an empty name would be rejected server-side anyway.
        if (!trimmed || trimmed === name) {
            setEditing(false);
            setDraft(name);
            return;
        }

        const formData = new FormData();
        formData.set("channel_id", channelId);
        formData.set("name", trimmed);

        startTransition(async () => {
            await renameGroup(formData);
            setEditing(false);
        });
    };

    const cancel = () => {
        setDraft(name);
        setEditing(false);
    };

    if (!editing) {
        return (
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-label text-ink-600 uppercase">Group name</p>
                    <p className="mt-0.5 truncate text-meta text-ink-900">{name}</p>
                </div>

                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    aria-label="Rename this group"
                    title="Rename this group"
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-bone-200 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
                >
                    <Pencil size={13} strokeWidth={1.5} aria-hidden />
                </button>
            </div>
        );
    }

    return (
        <div>
            <label htmlFor="group-name" className="text-label text-ink-600 uppercase">
                Group name
            </label>

            <div className="mt-1 flex items-center gap-1">
                <input
                    id="group-name"
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            save();
                        }
                        if (event.key === "Escape") cancel();
                    }}
                    maxLength={MAX_NAME}
                    disabled={pending}
                    // Warm tokens rather than the shared TextInput, which is still on the
                    // legacy blue palette and would read as foreign inside this panel.
                    className="min-w-0 flex-1 rounded-lg border border-bone-300 bg-bone-100 px-2 py-1 text-meta text-ink-900 outline-none transition-colors focus:border-accent-600 focus-visible:ring-2 focus-visible:ring-accent-600/40 disabled:opacity-50"
                />

                <button
                    type="button"
                    onClick={save}
                    disabled={pending || !draft.trim()}
                    aria-label="Save group name"
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-600 text-surface transition-colors hover:bg-accent-700 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-bone-300 disabled:text-ink-600"
                >
                    <Check size={13} strokeWidth={2} aria-hidden />
                </button>

                <button
                    type="button"
                    onClick={cancel}
                    disabled={pending}
                    aria-label="Cancel renaming"
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-bone-200 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
                >
                    <X size={13} strokeWidth={1.5} aria-hidden />
                </button>
            </div>
        </div>
    );
}
