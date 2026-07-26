import "server-only";

import { getCooldownUntil, recordFlaggedAttempt } from "@/lib/moderation-rate-limit";
import { containsBlockedWord } from "@/lib/word-filter";

// The same two-layer check /api/moderate-message used to run, moved to where the message is
// actually written.
//
// That route was advisory and could simply be skipped: the browser asked it for a verdict
// and then sent to Stream itself, so anything talking to Stream directly never had to ask.
// Running it inside sendMessage makes the check unavoidable, because there is no longer a
// write path that does not go through this file.
//
// Layer one is a local word list — instant, free, and catches most profanity and slurs.
// Layer two is OpenAI's moderation endpoint, which catches what a word list cannot (threats,
// self-harm, harassment with no slur in it) and only runs on what layer one let through, so
// the common case never leaves the process.
//
// Fails OPEN. A moderation outage lets messages through rather than taking chat down with
// it — the same call the original route made, kept deliberately.

/// Why a message was refused, and for how long.
///
/// `cooldownUntil` is null for the first couple of strikes: those are warnings, and the
/// message is still refused, but the user is not locked out yet. See lib/moderation-rate-limit.ts.
export type ModerationVerdict =
    | { allowed: true }
    | { allowed: false; cooldownUntil: number | null };

const ALLOWED: ModerationVerdict = { allowed: true };

export async function moderate(userId: string, text: string): Promise<ModerationVerdict> {
    if (!text.trim()) return ALLOWED;

    // Already serving a cooldown from an earlier message: refuse everything, even something
    // perfectly clean, without spending a check on it.
    const existingCooldown = getCooldownUntil(userId);
    if (existingCooldown) {
        return { allowed: false, cooldownUntil: existingCooldown };
    }

    if (containsBlockedWord(text)) {
        return { allowed: false, cooldownUntil: recordFlaggedAttempt(userId) };
    }

    if (!(await flaggedByOpenAI(text))) return ALLOWED;

    return { allowed: false, cooldownUntil: recordFlaggedAttempt(userId) };
}

async function flaggedByOpenAI(text: string): Promise<boolean> {
    try {
        const res = await fetch("https://api.openai.com/v1/moderations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
        });

        if (!res.ok) return false;

        const data = await res.json();
        return data.results?.[0]?.flagged ?? false;
    } catch {
        // Network error, rate limit, outage. Fail open.
        return false;
    }
}
