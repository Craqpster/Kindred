"use client";

import { BadgesSection } from "@/components/profile/BadgesSection";
import { useBadges } from "@/components/profile/BadgesProvider";

export default function BadgesClient({ initialProfileBadges }: { initialProfileBadges?: any[] }) {
  const { badges } = useBadges();
  return <BadgesSection badges={badges || []} />;
}
