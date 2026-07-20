"use client";

import { useEffect, useRef } from "react";
import * as Progress from "@radix-ui/react-progress";
import confetti from "canvas-confetti";

const TIER_THRESHOLDS = [0, 31, 71, 121];
const MAX_TIER = 3;

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

      fetch("/api/profile/badges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTier: level }),
      }).catch(console.error);

      prevLevel.current = level;
    }
  }, [level]);

  const prevThreshold = TIER_THRESHOLDS[Math.max(0, level - 1)];
  const nextThreshold =
    level >= MAX_TIER
      ? TIER_THRESHOLDS[MAX_TIER]
      : TIER_THRESHOLDS[Math.min(level, TIER_THRESHOLDS.length - 1)];

  const currentLevelPoints = Math.max(0, points - prevThreshold);
  const pointsNeeded = nextThreshold - prevThreshold;
  const progressPercentage =
    pointsNeeded > 0 ? Math.min(100, (currentLevelPoints / pointsNeeded) * 100) : 100;
  const pointsRemaining =
    level >= MAX_TIER ? 0 : Math.max(0, nextThreshold - points);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-star-sapphire font-[var(--font-lora)]">Confidence Level</h2>
          <p className="text-gray-600 text-sm">Your social journey</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-metro-blue text-white flex items-center justify-center font-bold text-lg">
          {level}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-ink font-medium">{points} pts</span>
          <span className="text-gray-500">
            {level >= MAX_TIER
              ? "Max tier reached"
              : `${pointsRemaining} pts to Tier ${level + 1}`}
          </span>
        </div>

        <Progress.Root
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
          value={progressPercentage}
        >
          <Progress.Indicator
            className="h-full bg-metro-blue transition-all duration-500 ease-in-out"
            style={{ transform: `translateX(-${100 - progressPercentage}%)` }}
          />
        </Progress.Root>
      </div>
    </div>
  );
}
