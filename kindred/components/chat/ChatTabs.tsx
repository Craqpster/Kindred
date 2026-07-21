"use client";

import { motion, useReducedMotion } from "motion/react";

import CountBadge from "@/components/ui/CountBadge";

export type ChatTab = "active" | "pending";

export default function ChatTabs({
    tab,
    onChange,
    pendingCount,
}: {
    tab: ChatTab;
    onChange: (tab: ChatTab) => void;
    pendingCount: number;
}) {
    const reduceMotion = useReducedMotion();

    const pill = (
        <motion.span
            layoutId="chats-tab-pill"
            className="absolute inset-0 rounded-full bg-ink-900"
            transition={
                reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 }
            }
        />
    );

    const options: readonly { value: ChatTab; label: string }[] = [
        { value: "active", label: "Active" },
        { value: "pending", label: "Pending" },
    ];

    return (
        <div className="m-3 flex shrink-0 items-center gap-0.5 self-start rounded-full bg-bone-200 p-0.5">
            {options.map(({ value, label }) => {
                const active = tab === value;

                return (
                    <button
                        key={value}
                        type="button"
                        // A mode switch, not navigation.
                        aria-pressed={active}
                        onClick={() => onChange(value)}
                        className={`relative cursor-pointer rounded-full px-3 py-1.5 text-meta font-medium transition-colors ${
                            active ? "text-surface" : "text-ink-900"
                        }`}
                    >
                        {active && pill}
                        <span className="relative z-10 flex items-center gap-1.5">
                            {label}
                            {value === "pending" && pendingCount > 0 && (
                                <>
                                    <CountBadge
                                        count={pendingCount}
                                        size={18}
                                        className="text-surface"
                                        circleClassName={
                                            active ? "bg-surface/25" : "bg-ink-900"
                                        }
                                    />
                                    <span className="sr-only">
                                        {pendingCount} pending{" "}
                                        {pendingCount === 1 ? "request" : "requests"}
                                    </span>
                                </>
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}