"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

/// Edit and delete, on your own messages.
///
/// Revealed on hover and on keyboard focus. Hover alone would make these unreachable without a
/// mouse, which for "delete the thing I just sent to the wrong person" is not a small gap —
/// focus-within on the row is what keeps them tabbable.
///
/// Delete asks first, inline rather than in a dialog. A modal for one irreversible tap is
/// heavier than the action deserves, but going straight through on a single click is how
/// people lose messages they meant to keep.
export default function MessageActions({
    onEdit,
    onDelete,
}: {
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [confirming, setConfirming] = useState(false);

    if (confirming) {
        return (
            <span className="flex items-center gap-1 text-label">
                <button
                    type="button"
                    onClick={onDelete}
                    className="cursor-pointer rounded-full bg-red-700 px-2 py-0.5 font-medium text-surface transition-colors hover:bg-red-800"
                >
                    Delete
                </button>
                <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="cursor-pointer rounded-full px-2 py-0.5 text-ink-600 transition-colors hover:text-ink-900"
                >
                    Cancel
                </button>
            </span>
        );
    }

    return (
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
                type="button"
                onClick={onEdit}
                aria-label="Edit message"
                title="Edit"
                className="cursor-pointer rounded-full p-1 text-ink-600 transition-colors hover:bg-bone-200 hover:text-ink-900"
            >
                <Pencil size={13} strokeWidth={1.5} aria-hidden />
            </button>

            <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label="Delete message"
                title="Delete"
                className="cursor-pointer rounded-full p-1 text-ink-600 transition-colors hover:bg-bone-200 hover:text-red-700"
            >
                <Trash2 size={13} strokeWidth={1.5} aria-hidden />
            </button>
        </span>
    );
}
