"use client";

import { useEffect, useRef } from "react";
import * as Progress from "@radix-ui/react-progress";
import confetti from "canvas-confetti";
import { TIER_THRESHOLDS, MAX_TIER } from "@/lib/confidence-tiers";

export function ConfidenceCard({ level, points }: { level: number; points: number }) {
    const prevLevel = useRef(level);

    useEffect(() => {
        if (level > prevLevel.current) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#689cd5", "#3f79af", "#153d74"],
            });
            fetch("/api/profile/badges", { method: "PATCH" }).catch(console.error);
            prevLevel.current = level;
        }
    }, [level]);

    const prevThreshold = TIER_THRESHOLDS[Math.max(0, level - 1)];
    const nextThreshold = level >= MAX_TIER ? TIER_THRESHOLDS[MAX_TIER] : TIER_THRESHOLDS[Math.min(level, TIER_THRESHOLDS.length - 1)];

    const currentLevelPoints = Math.max(0, points - prevThreshold);
    const pointsNeeded = nextThreshold - prevThreshold;
    const progressPercentage = pointsNeeded > 0 ? Math.min(100, (currentLevelPoints / pointsNeeded) * 100) : 100;
    const pointsRemaining = level >= MAX_TIER ? 0 : Math.max(0, nextThreshold - points);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="font-display text-xl font-bold text-star-sapphire">Confidence Level</h2>
                    <p className="text-sm text-star-sapphire/70">Your social journey</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-star-sapphire font-display font-bold text-surface shadow-sm">
                    {level}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="font-semibold text-star-sapphire">{points} pts</span>
                    <span className="text-star-sapphire/70 font-medium">
                        {level >= MAX_TIER ? "Max tier reached" : `${pointsRemaining} pts to Tier ${level + 1}`}
                    </span>
                </div>

                <Progress.Root
                    className="h-2.5 w-full overflow-hidden rounded-full bg-bone-200"
                    value={progressPercentage}
                >
                    <Progress.Indicator
                        className="h-full bg-star-sapphire transition-all duration-500 ease-smooth"
                        style={{ transform: `translateX(-${100 - progressPercentage}%)` }}
                    />
                </Progress.Root>
            </div>
        </div>
    );
}