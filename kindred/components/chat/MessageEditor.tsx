"use client";

import { useEffect, useRef, useState } from "react";

/// Editing a message in place, where the bubble was.
///
/// In place rather than back in the composer: the composer is for the next thing you say, and
/// moving a message down there to change it loses the context of what it was replying to.
export default function MessageEditor({
    initialBody,
    saving,
    error,
    onSave,
    onCancel,
}: {
    initialBody: string;
    saving: boolean;
    /// A moderation refusal, shown under the box. The text stays put so it can be rephrased
    /// rather than retyped.
    error: string | null;
    onSave: (body: string) => void;
    onCancel: () => void;
}) {
    const [draft, setDraft] = useState(initialBody);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Opened with the caret at the end, not selecting everything: an edit is usually a fix to
    // part of a message, and select-all means one keystroke away from losing the lot.
    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, []);

    const save = () => {
        const body = draft.trim();
        // An empty edit is a delete asked for the wrong way round, and answering it by
        // deleting would be a surprise. Cancelling is the honest no-op.
        if (!body || body === initialBody.trim()) {
            onCancel();
            return;
        }
        onSave(body);
    };

    return (
        <div className="flex w-full flex-col gap-1.5">
            <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        save();
                    }
                    if (event.key === "Escape") onCancel();
                }}
                rows={2}
                maxLength={4000}
                disabled={saving}
                aria-label="Edit message"
                className="w-full resize-none rounded-2xl border border-accent-600 bg-surface px-3.5 py-2 text-meta text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-accent-600/40 disabled:opacity-60"
            />

            {error && (
                <p role="alert" className="text-label text-red-700">
                    {error}
                </p>
            )}

            <p className="text-label text-ink-600">
                Enter to save · Escape to cancel
            </p>
        </div>
    );
}
