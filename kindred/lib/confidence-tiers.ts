// Shared between lib/confidence.ts (server, decides when a tier-up happens) and
// ConfidenceCard.tsx (client, renders progress toward the next tier) so there is only
// one definition of what a tier costs - not two that can drift apart.
export const TIER_THRESHOLDS = [0, 31, 71, 121];
export const MAX_TIER = 3;

export function tierForPoints(points: number): number {
    if (points >= TIER_THRESHOLDS[2]) return MAX_TIER;
    if (points >= TIER_THRESHOLDS[1]) return 2;
    return 1;
}
