"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { useBadges } from "@/app/profile/components/BadgesProvider";

export default function BadgesConfetti({ initialProfileBadges }: { initialProfileBadges?: any[] }) {
  const { badges } = useBadges();
  const prevRef = useRef<Set<string>>(new Set((initialProfileBadges || []).map((pb) => pb.badge?.id)));
  const firedRef = useRef(false);

  useEffect(() => {
    if (!badges) return;
    const unlocked = new Set(badges.filter((b: any) => b.unlocked).map((b: any) => b.id));
    const prev = prevRef.current;
    const newUnlocked = [...unlocked].filter((id) => !prev.has(id));
    if (newUnlocked.length > 0 && prev.size > 0 && !firedRef.current) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      firedRef.current = true;
    }
    prevRef.current = unlocked;
  }, [badges]);

  return null;
}
