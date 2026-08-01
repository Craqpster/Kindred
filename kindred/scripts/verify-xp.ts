// Checks the level maths the chat XP badge draws from.
//
// The badge renders a progress ring as `xpIntoLevel / xpForNextLevel`, straight into an SVG
// strokeDashoffset. That division is the reason this exists: an out-of-range or non-finite
// result does not throw and does not look broken in review — the ring simply does not draw,
// or draws full at level 1 forever. It has to be checked by running it.
//
// Also pins the level boundaries themselves. getChatLevel walks the levels instead of
// inverting the triangular number precisely so a value landing exactly on a boundary is not
// lost to floating point, and that claim is only worth anything if something tests the
// boundaries.
//
// Pure maths, no database.
//
// If this script HANGS instead of failing, that is the result: getChatLevel's
// Number.isFinite guard has been removed, and `while (Infinity >= …)` never exits. The
// guard is load-bearing for more than tidiness — without it an infinite XP value locks the
// render rather than drawing badly.
//
// Run: npm run verify:xp
import { getChatLevel, xpToReachNextLevel, XP_PER_LEVEL_STEP } from "../lib/chat-level";
import { dailyBonusThreshold, utcDay } from "../lib/confidence-xp";

type Check = { name: string; ok: boolean; note?: string };

const checks: Check[] = [];
/// One check, recorded from whatever went wrong — or null when nothing did. The loops below
/// keep only their FIRST problem, so a bad boundary reports the boundary rather than two
/// thousand consecutive failures.
const record = (name: string, problem: string | null) =>
    checks.push(problem ? { name, ok: false, note: problem } : { name, ok: true });

// The ring divides by xpForNextLevel on every render, across every total a chat can reach.
let ringBad: string | null = null;
let monotonicBad: string | null = null;
let previousLevel = 1;

for (let xp = 0; xp <= 2000; xp++) {
    const { level, xpIntoLevel, xpForNextLevel } = getChatLevel(xp);

    if (level < previousLevel && !monotonicBad) monotonicBad = `level fell at xp=${xp}`;
    previousLevel = level;

    const fraction = xpIntoLevel / xpForNextLevel;
    if (!ringBad && !(fraction >= 0 && fraction < 1)) {
        ringBad = `fraction ${fraction} at xp=${xp} (${xpIntoLevel}/${xpForNextLevel})`;
    }
    if (!ringBad && xpForNextLevel !== xpToReachNextLevel(level)) {
        ringBad = `xpForNextLevel disagrees with xpToReachNextLevel at xp=${xp}`;
    }
}

record("the ring fraction stays in [0, 1)", ringBad);
record("level never decreases as XP rises", monotonicBad);

// Total XP to sit at level L is XP_PER_LEVEL_STEP · L(L−1)/2. Both sides of each boundary.
let boundaryBad: string | null = null;
for (let level = 1; level <= 20; level++) {
    const start = (XP_PER_LEVEL_STEP * level * (level - 1)) / 2;

    if (getChatLevel(start).level !== level) {
        boundaryBad ??= `xp ${start} should be level ${level}, got ${getChatLevel(start).level}`;
    }
    if (getChatLevel(start).xpIntoLevel !== 0) {
        boundaryBad ??= `level ${level} should begin at 0 into the level`;
    }
    if (start > 0 && getChatLevel(start - 1).level !== level - 1) {
        boundaryBad ??= `xp ${start - 1} should still be level ${level - 1}`;
    }
}

record("level boundaries land exactly", boundaryBad);

// Nothing should be able to put a NaN into an SVG attribute. NaN is the interesting one:
// Math.floor(NaN) is NaN and Math.max(0, NaN) is NaN, so clamping alone does not stop it.
let garbageBad: string | null = null;
for (const value of [-1, -1000, 0.5, 7.9, NaN, Infinity, -Infinity]) {
    const { xpIntoLevel, xpForNextLevel, level } = getChatLevel(value);
    if (!Number.isFinite(xpIntoLevel / xpForNextLevel)) {
        garbageBad ??= `xp=${value} gives a non-finite ring`;
    }
    if (!Number.isFinite(level) || level < 1) garbageBad ??= `xp=${value} gives level ${level}`;
}

record("junk XP still draws a finite ring", garbageBad);

// The bonus meter reads "messagesToday of bonusThreshold", so a threshold outside its
// documented range would render a meter that cannot be filled.
let thresholdBad: string | null = null;
for (let level = 1; level <= 50; level++) {
    const threshold = dailyBonusThreshold(level);
    if (threshold < 5 || threshold > 15) thresholdBad ??= `threshold ${threshold} at level ${level}`;
}

record("the daily bonus threshold stays within 5..15", thresholdBad);

// The award path and the badge bucket "today" with this same function; a value that is not
// midnight UTC would put them in different buckets for part of every day.
const day = utcDay();
const midnight =
    day.getUTCHours() === 0 &&
    day.getUTCMinutes() === 0 &&
    day.getUTCSeconds() === 0 &&
    day.getUTCMilliseconds() === 0;

record("utcDay is midnight UTC", midnight ? null : day.toISOString());

for (const check of checks) {
    console.log(`${check.ok ? "  ok  " : " FAIL "} ${check.name}${check.note ? ` — ${check.note}` : ""}`);
}

const failed = checks.filter((check) => !check.ok).length;
console.log(`\n${checks.length - failed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
