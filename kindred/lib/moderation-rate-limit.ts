import "server-only";

// In-memory only: resets on server restart, and won't be shared across instances if
// this ever runs on multiple server processes. Fine for now - the goal is just to stop
// someone from spamming variations of a blocked message, not to be a bulletproof
// distributed rate limiter.
//
// A flagged message is always blocked from sending, but the first couple within a
// short window are treated as warnings only - no cooldown yet. Only once someone hits
// 3+ flags inside that same window does an actual (escalating) cooldown kick in.
const STRIKE_WINDOW_MS = 3 * 60 * 1000;
const WARNINGS_BEFORE_COOLDOWN = 2;
const COOLDOWNS_MS = [
    30 * 1000, // 1st cooldown (3rd strike overall)
    2 * 60 * 1000, // 2nd cooldown
    5 * 60 * 1000, // 3rd cooldown
    15 * 60 * 1000, // 4th cooldown
    30 * 60 * 1000, // 5th+ cooldown
];

type UserState = { flagTimestamps: number[]; cooldownUntil: number };

const state = new Map<string, UserState>();

/// The timestamp (ms) a user is blocked until, or null if they're clear to send.
/// Does not add a new strike - use this for the "are they currently serving a
/// cooldown" check before even looking at their new message.
export function getCooldownUntil(userId: string): number | null {
    const entry = state.get(userId);
    if (!entry || entry.cooldownUntil <= Date.now()) return null;
    return entry.cooldownUntil;
}

/// Call this whenever a message actually comes back flagged. Returns a cooldown
/// timestamp once the user has enough recent strikes to warrant one, or null if this
/// was still just within the warning allowance.
export function recordFlaggedAttempt(userId: string): number | null {
    const entry = state.get(userId) ?? { flagTimestamps: [], cooldownUntil: 0 };
    const now = Date.now();

    entry.flagTimestamps = entry.flagTimestamps.filter((t) => now - t < STRIKE_WINDOW_MS);
    entry.flagTimestamps.push(now);

    if (entry.flagTimestamps.length <= WARNINGS_BEFORE_COOLDOWN) {
        state.set(userId, entry);
        return null;
    }

    const cooldownIndex = entry.flagTimestamps.length - WARNINGS_BEFORE_COOLDOWN - 1;
    const cooldownMs = COOLDOWNS_MS[Math.min(cooldownIndex, COOLDOWNS_MS.length - 1)];
    entry.cooldownUntil = now + cooldownMs;
    state.set(userId, entry);
    return entry.cooldownUntil;
}
