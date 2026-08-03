import "server-only";

import { prisma } from "./prisma";

// Strike tracking for the moderation filter, one row per person in Postgres.
//
// It used to be a module-level Map. That worked locally and quietly failed in production:
// serverless invocations do not share memory, so a person's strikes landed in whichever
// instance happened to serve the request, and a deploy wiped every count. The escalating
// cooldown below could barely fire, because reaching three strikes needed three requests to
// land on the same warm instance inside the window.
//
// Postgres fixes both — the count survives a deploy and is shared across instances.
//
// A flagged message is always blocked from sending, but the first couple within a short
// window are treated as warnings only - no cooldown yet. Only once someone hits 3+ flags
// inside that same window does an actual (escalating) cooldown kick in.
const STRIKE_WINDOW_MS = 3 * 60 * 1000;
const WARNINGS_BEFORE_COOLDOWN = 2;
const COOLDOWNS_MS = [
    30 * 1000, // 1st cooldown (3rd strike overall)
    2 * 60 * 1000, // 2nd cooldown
    5 * 60 * 1000, // 3rd cooldown
    15 * 60 * 1000, // 4th cooldown
    30 * 60 * 1000, // 5th+ cooldown
];

/// The timestamp (ms) a user is blocked until, or null if they're clear to send.
/// Does not add a new strike - use this for the "are they currently serving a
/// cooldown" check before even looking at their new message.
///
/// Two ways to be clear, and the database can express a difference the Map could not: no row
/// at all (never flagged), or a row whose cooldown column is empty (flagged, but still inside
/// the warning allowance). The old code collapsed both into a sentinel 0.
export async function getCooldownUntil(userId: string): Promise<number | null> {
    const entry = await prisma.moderation_state.findUnique({
        where: { profile_id: userId },
        select: { cooldown_until: true },
    });

    if (!entry?.cooldown_until) return null;

    const until = entry.cooldown_until.getTime();
    return until > Date.now() ? until : null;
}

/// Call this whenever a message actually comes back flagged. Returns a cooldown
/// timestamp once the user has enough recent strikes to warrant one, or null if this
/// was still just within the warning allowance.
///
/// The arithmetic in the middle is unchanged from the in-memory version, which is why the
/// column is an array of timestamps rather than a row per strike: the filter-and-push stayed
/// exactly as it was, and only the storage moved.
///
/// Read-modify-write, so two flagged messages from the same person landing in the same instant
/// can have one overwrite the other and lose a strike. Accepted: strikes are per-person and
/// rare, and the cost of losing one in a dead heat is that somebody gets a third warning
/// instead of a thirty-second cooldown. A row per strike would not have that problem, at the
/// cost of needing its own cleanup.
export async function recordFlaggedAttempt(userId: string): Promise<number | null> {
    const existing = await prisma.moderation_state.findUnique({
        where: { profile_id: userId },
        select: { flag_timestamps: true },
    });

    // Timestamps in, milliseconds out: the column stores real dates, the maths below works in
    // milliseconds. No row yet simply means no strikes yet.
    const flag_timestamps = (existing?.flag_timestamps ?? []).map((at) => at.getTime());
    const now = Date.now();

    const recent = flag_timestamps.filter((t) => now - t <= STRIKE_WINDOW_MS);
    recent.push(now);

    if (recent.length <= WARNINGS_BEFORE_COOLDOWN) {
        await save(userId, recent, null);
        return null;
    }

    const cooldownIndex = recent.length - WARNINGS_BEFORE_COOLDOWN - 1;
    const cooldownMs = COOLDOWNS_MS[Math.min(cooldownIndex, COOLDOWNS_MS.length - 1)];
    const cooldownUntil = now + cooldownMs;

    await save(userId, recent, new Date(cooldownUntil));
    return cooldownUntil;
}

/// Writes the row, creating it the first time somebody is flagged.
///
/// Its own function because both exits above write, and an upsert spelled out twice is a shape
/// that drifts. upsert rather than update: a person who has never been flagged has no row yet,
/// and `create` is what that case needs.
async function save(userId: string, strikes: number[], cooldownUntil: Date | null) {
    const flag_timestamps = strikes.map((t) => new Date(t));

    await prisma.moderation_state.upsert({
        where: { profile_id: userId },
        create: { profile_id: userId, flag_timestamps, cooldown_until: cooldownUntil },
        update: { flag_timestamps, cooldown_until: cooldownUntil },
    });
}
