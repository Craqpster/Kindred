// Pure, no server dependency - both the API route and the client badge need this same
// math, so it lives in one shared place instead of being duplicated.

// How many XP points (qualifying messages, see lib/confidence.ts) it takes to reach the
// next chat level. Flat for v1 - easy constant to bump if leveling feels too fast/slow.
export const XP_PER_LEVEL = 5;

export function getChatLevel(xp: number) {
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const xpIntoLevel = xp % XP_PER_LEVEL;

    return { level, xpIntoLevel, xpPerLevel: XP_PER_LEVEL };
}
