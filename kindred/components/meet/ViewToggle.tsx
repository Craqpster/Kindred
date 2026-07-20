"use client";

import { motion, useReducedMotion } from "motion/react";
import { useOptimistic } from "react";

import { setMeetView } from "@/app/(app)/meet/actions";
import type { MeetView } from "@/lib/meet-view";

const OPTIONS: readonly { value: MeetView; label: string }[] = [
    { value: "spotlight", label: "Spotlight" },
    { value: "grid", label: "Grid" },
];

export default function ViewToggle({ view }: { view: MeetView }) {
    const [optimisticView, setOptimisticView] = useOptimistic(view);
    const reduceMotion = useReducedMotion();

    const pill = (
        <motion.span
            layoutId="meet-view-pill"
            className="absolute inset-0 rounded-full bg-ink-900"
            transition={
                reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 }
            }
        />
    );

    return (
        <form
            action={(formData) => {
                setOptimisticView(formData.get("view") as MeetView);
                return setMeetView(formData);
            }}
            // A recessed well: bone-200 sits a step below the page, so the track reads as
            // carved into it rather than as another floating chip.
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-bone-200 p-0.5"
        >
            {OPTIONS.map(({ value, label }) => {
                const active = optimisticView === value;

                return (
                    <button
                        key={value}
                        type="submit"
                        name="view"
                        value={value}
                        // A mode switch, not navigation — and read from the optimistic
                        // value so it flips with the pill rather than lagging behind it.
                        aria-pressed={active}
                        className={`relative cursor-pointer rounded-full px-3 py-1.5 text-meta font-medium transition-colors ${
                            // ink-900 when inactive, never ink-600: ink-600 on bone-200 is
                            // 4.12:1 and fails AA. The pill alone carries the state, which
                            // is the whole point of having one.
                            active ? "text-surface" : "text-ink-900"
                        }`}
                    >
                        {active && pill}
                        <span className="relative z-10">{label}</span>
                    </button>
                );
            })}
        </form>
    );
}