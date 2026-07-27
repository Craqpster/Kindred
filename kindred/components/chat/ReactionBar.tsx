"use client";

import { SmilePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { REACTION_EMOJI, type ReactionEmoji } from "@/lib/chat/reactions";
import type { MessageReaction } from "@/lib/chat/types";

/// The reactions on one message, plus the button that adds another.
///
/// Renders nothing at all when a message has no reactions and is not hovered — an empty
/// strip under every bubble would double the vertical rhythm of the timeline for something
/// most messages never use. The add button is revealed by the parent's `group-hover`, and is
/// always present for keyboard users, who have no hover to reveal it with.
export default function ReactionBar({
    reactions,
    userId,
    align,
    onToggle,
}: {
    reactions: MessageReaction[];
    /// Which pills read as "you reacted".
    userId: string;
    /// Which side the picker opens from. Row alignment is the caller's job — this sits in a
    /// shared meta row with the delivery tick, so only the popover anchor is decided here.
    align: "start" | "end";
    onToggle: (emoji: ReactionEmoji) => void;
}) {
    const [picking, setPicking] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // A picker that stays open after you have clicked elsewhere is a picker you have to
    // dismiss twice. Pointerdown rather than click, so it closes on the way down and does
    // not race the button that opened it.
    useEffect(() => {
        if (!picking) return;

        const onPointerDown = (event: PointerEvent) => {
            if (!pickerRef.current?.contains(event.target as Node)) setPicking(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPicking(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [picking]);

    return (
        <div
            ref={pickerRef}
            className="relative flex flex-wrap items-center gap-1"
        >
            {reactions.map((reaction) => {
                const mine = reaction.reactedBy.includes(userId);
                return (
                    <button
                        key={reaction.emoji}
                        type="button"
                        onClick={() => onToggle(reaction.emoji as ReactionEmoji)}
                        aria-pressed={mine}
                        aria-label={`${reaction.emoji} ${reaction.reactedBy.length}${
                            mine ? ", including you" : ""
                        }`}
                        className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-label leading-none transition-colors ${
                            mine
                                ? "border-accent-600 bg-accent-600/10 text-accent-600"
                                : "border-bone-300 bg-surface text-ink-600 hover:border-ink-900/20"
                        }`}
                    >
                        <span aria-hidden>{reaction.emoji}</span>
                        <span className="tabular-nums">{reaction.reactedBy.length}</span>
                    </button>
                );
            })}

            <button
                type="button"
                onClick={() => setPicking((open) => !open)}
                aria-label="Add a reaction"
                aria-expanded={picking}
                className={`flex items-center rounded-full border border-transparent p-0.5 text-ink-600 transition-opacity hover:border-bone-300 hover:bg-surface focus-visible:opacity-100 ${
                    picking ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
            >
                <SmilePlus size={14} strokeWidth={1.5} aria-hidden />
            </button>

            {picking && (
                <div
                    role="menu"
                    className={`absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full border border-bone-300 bg-surface p-1 shadow-card ${
                        align === "end" ? "right-0" : "left-0"
                    }`}
                >
                    {REACTION_EMOJI.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            role="menuitem"
                            aria-label={emoji}
                            onClick={() => {
                                onToggle(emoji);
                                setPicking(false);
                            }}
                            className="rounded-full px-1.5 py-0.5 text-body leading-none hover:bg-bone-100"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
