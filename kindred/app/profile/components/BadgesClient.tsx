"use client";

import { BadgesSection } from "@/app/profile/components/BadgesSection";
import { useBadges } from "@/app/profile/components/BadgesProvider";

export default function BadgesClient({ initialProfileBadges }: { initialProfileBadges?: any[] }) {
  const { badges } = useBadges();
  return <BadgesSection badges={badges || []} />;
}
