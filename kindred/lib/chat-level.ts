// Pure, no server dependency - both the API route and the client badge need this same
// math, so it lives in one shared place instead of being duplicated.

/// Reaching level N costs `XP_PER_LEVEL_STEP × N`, so each level is a bit dearer than the
/// one before it: 5 XP to reach level 2, 10 more for level 3, 15 more for level 4. Total
/// XP to sit at level L is therefore 5 · L(L−1)/2.
///
/// Flat levels made a months-old conversation and a day-old one feel the same distance
/// apart, which is the opposite of what a level is for.
export const XP_PER_LEVEL_STEP = 5;

/// XP needed to go from `level` to `level + 1`.
export function xpToReachNextLevel(level: number): number {
    return XP_PER_LEVEL_STEP * level;
}

/// Total XP required to be sitting at `level`.
function xpAtLevelStart(level: number): number {
    return (XP_PER_LEVEL_STEP * level * (level - 1)) / 2;
}

export function getChatLevel(xp: number) {
    // Solved by walking the levels rather than by inverting the triangular number. The
    // closed form is floor((1 + sqrt(1 + 8·xp/5)) / 2), which is exact in algebra and not
    // in floating point - a value that should land exactly on a boundary can come back as
    // 2.9999... and silently floor to the level below. Chat XP is small enough that the
    // loop costs nothing and states the rule it implements.
    //
    // Number.isFinite before the clamp, not just Math.max: Math.floor(NaN) is NaN and
    // Math.max(0, NaN) is NaN too, so clamping alone lets both NaN and Infinity through, and
    // they fail in opposite ways. NaN fails quietly — every `NaN >= x` is false, so the loop
    // settles on level 1 and returns a NaN xpIntoLevel, which reaches the badge as a NaN
    // strokeDashoffset and simply draws no ring. Infinity does not fail quietly at all:
    // `Infinity >= x` is always true, so the loop below never terminates and takes the render
    // with it. Neither is reachable from an integer column today; this is one line to make
    // sure neither ever becomes reachable. See scripts/verify-xp.ts.
    const safeXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;

    let level = 1;
    while (safeXp >= xpAtLevelStart(level + 1)) level++;

    return {
        level,
        xpIntoLevel: safeXp - xpAtLevelStart(level),
        xpForNextLevel: xpToReachNextLevel(level),
    };
}
