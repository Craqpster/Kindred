"use client";

import { useEffect, useRef, useState } from "react";

import {
    DAILY_MESSAGE_XP_CAP,
    XP_PER_MESSAGE,
    XP_PER_PROMPT_ANSWER,
} from "@/lib/confidence-xp";
import type { ConversationXp } from "@/lib/chat/types";

// 44px overall. The ring sits in the middle of the conversation header rather than in a
// corner, so it is read rather than merely noticed — and at 32px the level number inside it
// was smaller than any other text on the screen.
const SIZE = 44;
const CENTRE = SIZE / 2;
const RADIUS = 18;
const STROKE = 3.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/// The conversation's level, as a ring that fills toward the next one.
///
/// Shows the level number rather than the raw XP total: the total is a number nobody has a
/// feel for, where "Level 3, most of the way to 4" is the thing a person actually wants to
/// know. The exact figures are in the popover for anyone who does want them.
///
/// The numbers in that popover are imported from lib/confidence-xp.ts rather than written
/// into the markup, so what the UI promises and what the award path pays cannot drift.
export default function ChatLevelBadge({ xp }: { xp: ConversationXp }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    // Guarded: xpForNextLevel is a level cost and never zero, but a divide that can produce
    // NaN silently draws nothing at all rather than failing where it can be seen.
    const progress = xp.xpForNextLevel > 0 ? xp.xpIntoLevel / xp.xpForNextLevel : 0;

    const bonusDone = xp.bonusEarnedToday || xp.messagesToday >= xp.bonusThreshold;

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-label={`Chat level ${xp.level}, ${xp.xpIntoLevel} of ${xp.xpForNextLevel} XP to the next level`}
                className="flex items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
                    <circle
                        cx={CENTRE}
                        cy={CENTRE}
                        r={RADIUS}
                        fill="none"
                        strokeWidth={STROKE}
                        className="stroke-bone-300"
                    />
                    <circle
                        cx={CENTRE}
                        cy={CENTRE}
                        r={RADIUS}
                        fill="none"
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                        // Starts at 12 o'clock instead of 3, which is where a progress ring
                        // is read from.
                        transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
                        className="stroke-accent-600 transition-[stroke-dashoffset] duration-500"
                    />
                    <text
                        x={CENTRE}
                        y={CENTRE}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-ink-900 text-meta font-semibold"
                    >
                        {xp.level}
                    </text>
                </svg>
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="How this chat earns XP"
                    // Centred under the ring rather than right-aligned to it, now that the
                    // ring itself sits in the middle of the header instead of in a corner.
                    className="absolute top-full left-1/2 z-20 mt-2 w-64 -translate-x-1/2 rounded-card border border-bone-300 bg-surface p-3 text-left shadow-card"
                >
                    <p className="text-meta font-medium text-ink-900">
                        Chat level {xp.level}
                    </p>
                    <p className="mt-0.5 text-label text-ink-600">
                        {xp.xpIntoLevel} / {xp.xpForNextLevel} XP toward level {xp.level + 1}
                        {" · "}
                        {xp.xp} total
                    </p>

                    <hr className="my-2.5 border-bone-300" />

                    <p className="text-label uppercase text-ink-600">How it grows</p>
                    <ul className="mt-1 space-y-0.5 text-label text-ink-600">
                        <li>
                            A real reply: <strong className="text-ink-900">+{XP_PER_MESSAGE}</strong>
                        </li>
                        <li>
                            Answering an icebreaker:{" "}
                            <strong className="text-ink-900">+{XP_PER_PROMPT_ANSWER}</strong>
                        </li>
                        <li>Up to {DAILY_MESSAGE_XP_CAP} XP a day from chatting</li>
                    </ul>

                    <hr className="my-2.5 border-bone-300" />

                    <p className="text-label uppercase text-ink-600">Today&rsquo;s bonus</p>
                    <p className="mt-1 text-label text-ink-600">
                        {xp.bonusEarnedToday
                            ? "Earned — everyone showed up today."
                            : bonusDone
                              ? "Your part is done. Waiting on everyone else."
                              : `${xp.messagesToday} of ${xp.bonusThreshold} messages from you. Everyone has to get there.`}
                    </p>
                </div>
            )}
        </div>
    );
}
