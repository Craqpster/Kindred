/// What a qualifying message is worth. An icebreaker answer pays more because it is the
/// harder thing to do - it asks someone to volunteer something about themselves to a
/// stranger, which is exactly the behaviour the confidence ladder exists to encourage.
///
/// Split out of lib/confidence.ts, which is `server-only`: the level popover tells the
/// user how XP is earned, and those numbers have to be the ones actually being awarded
/// rather than a copy in the markup that quietly drifts. Importing them from confidence.ts
/// would drag Prisma into the browser bundle.
export const XP_PER_MESSAGE = 1;
export const XP_PER_PROMPT_ANSWER = 3;

/// How much ordinary chatter one person can bank in one chat in one day.
///
/// Without a ceiling, confidence tier (31/71/121 points) is a measure of typing stamina:
/// a single long session crosses two tiers, and two accounts trading 15-character
/// messages can mint points indefinitely. The cap turns grinding into a dead end while
/// leaving the behaviours worth encouraging — answering a prompt, both people actually
/// showing up — paying on top of it.
export const DAILY_MESSAGE_XP_CAP = 10;

/// The daily "you both showed up" bonus.
///
/// Volume is easy to fake alone; a mutual threshold is not, because it needs the other
/// person to genuinely participate. Both numbers scale with chat level so a warm
/// conversation has to work harder for the same reward.
const DAILY_BONUS_BASE_MESSAGES = 5;
const DAILY_BONUS_MAX_MESSAGES = 15;
const DAILY_BONUS_BASE_XP = 5;
const DAILY_BONUS_XP_PER_LEVEL = 2;

/// Midnight UTC for today — the key `daily_chat_activity` and `daily_bonus_awards` are
/// bucketed by, and therefore the one the badge has to read back with.
///
/// UTC rather than either participant's local day so that two people in different timezones
/// are always working toward the same bucket. Lives here, next to the amounts, because the
/// award path and the read path have to agree on which day "today" is; two copies of this
/// would differ for a few hours around midnight and be very hard to see.
export function utcDay(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/// Qualifying messages EACH member must send today for the chat to earn its bonus.
export function dailyBonusThreshold(chatLevel: number): number {
    const scaled = DAILY_BONUS_BASE_MESSAGES + Math.max(0, chatLevel - 1);
    return Math.min(scaled, DAILY_BONUS_MAX_MESSAGES);
}

/// What that bonus pays — to the chat once, and to each member individually.
export function dailyBonusXp(chatLevel: number): number {
    return DAILY_BONUS_BASE_XP + DAILY_BONUS_XP_PER_LEVEL * Math.max(0, chatLevel - 1);
}
