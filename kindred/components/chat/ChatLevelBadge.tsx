"use client";

import { useEffect, useRef, useState } from "react";

import {
    DAILY_MESSAGE_XP_CAP,
    XP_PER_MESSAGE,
    XP_PER_PROMPT_ANSWER,
} from "@/lib/confidence-xp";
import type { ConversationXp } from "@/lib/chat/types";

const RADIUS = 13;
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
                <svg width={32} height={32} viewBox="0 0 32 32" aria-hidden>
                    <circle
                        cx={16}
                        cy={16}
                        r={RADIUS}
                        fill="none"
                        strokeWidth={3}
                        className="stroke-bone-300"
                    />
                    <circle
                        cx={16}
                        cy={16}
                        r={RADIUS}
                        fill="none"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                        // Starts at 12 o'clock instead of 3, which is where a progress ring
                        // is read from.
                        transform="rotate(-90 16 16)"
                        className="stroke-accent-600 transition-[stroke-dashoffset] duration-500"
                    />
                    <text
                        x={16}
                        y={16}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-ink-900 text-label font-medium"
                    >
                        {xp.level}
                    </text>
                </svg>
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="How this chat earns XP"
                    className="absolute right-0 top-full z-20 mt-2 w-64 rounded-card border border-bone-300 bg-surface p-3 text-left shadow-card"
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
