"use client";

import { BadgesSection } from "@/components/profile/BadgesSection";
import { useBadges } from "@/components/profile/BadgesProvider";

export default function BadgesClient() {
  const { badges } = useBadges();

  const profileBadges = (badges ?? [])
    .filter((b) => b.unlocked)
    .map((b) => ({ profile_id: "", badge_id: b.id, badge: b }));

  return <BadgesSection badges={profileBadges} />;
}