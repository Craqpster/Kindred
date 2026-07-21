import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { getChatLevel } from "@/lib/chat-level";
import {
    dailyBonusThreshold,
    dailyBonusXp,
    DAILY_MESSAGE_XP_CAP,
    XP_PER_MESSAGE,
    XP_PER_PROMPT_ANSWER,
} from "@/lib/confidence-xp";
import { prisma } from "@/lib/prisma";
import { streamServerClient } from "@/lib/stream";
import { tierForPoints } from "@/lib/confidence-tiers";

// Below this, a message doesn't count as "real effort" - filters out "ok", "lol",
// single emoji, etc. Chosen to be generous rather than strict for v1.
const MIN_MESSAGE_LENGTH = 15;

/// The award amounts live in lib/confidence-xp.ts so the client can state them without
/// importing this module. Re-exported here because this is where they are spent, and a
/// reader following the award path should not have to go hunting.
///
/// Note that confidence-tiers.ts's thresholds were picked when everything paid 1, so
/// tiers arrive faster now. Deliberate for the moment; retune there, not here.
export { XP_PER_MESSAGE, XP_PER_PROMPT_ANSWER } from "@/lib/confidence-xp";

/// What an award actually did, for callers that want to tell the user about it.
/// `null` from awardConfidenceForMessage means nothing was awarded - which the old
/// void return could not express, leaving the client unable to tell "earned XP" from
/// "didn't qualify".
export type AwardResult = {
    /// Everything this message earned the sender, message plus any bonus.
    xpAwarded: number;
    /// Just the message's own share. Zero once the daily cap is reached - the message
    /// still counted toward the bonus threshold, it simply stopped paying.
    messageXp: number;
    /// The daily "everyone showed up" bonus, if this message is what completed it.
    bonusXp: number;
    dailyBonusEarned: boolean;
    /// The channel's new shared total, feeding the chat level.
    channelXp: number;
    /// The sender's new personal total, feeding their confidence tier.
    confidencePoints: number;
    confidenceLevel: number;
    tierUp: boolean;
};

/// Midnight UTC for today, the key `daily_chat_activity` and `daily_bonus_awards` are
/// bucketed by. UTC rather than either participant's local day so that two people in
/// different timezones are always working toward the same bucket.
function utcDay(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/// Awards XP to both profiles.confidence_points (the sender's own, global, per-person
/// counter) AND channel_xp (a single number shared by everyone in that specific
/// conversation) when a just-sent message is substantial (see MIN_MESSAGE_LENGTH) AND
/// is a genuine back-and-forth turn - the previous message in the channel was from the
/// other participant, not another message from the same sender in a row. Both signals
/// come straight from the planning doc's "verbosity" and "back-and-forth depth"
/// criteria; the two targets are separate stats, not the same number in two places.
///
/// profiles.confidence_level is the TIER shown on the profile page (ConfidenceCard) -
/// this only bumps it, and unlocks the matching badges, once confidence_points crosses
/// the next tier's threshold. Everything below is one transaction so a tier-up can never
/// happen without the badge that goes with it, or vice versa.
///
/// Returns null when nothing was awarded, and an AwardResult describing the new totals
/// when something was. This is still a background signal - callers should not await it in
/// a way that blocks or fails the actual message send - but the caller needs to be able to
/// tell the difference in order to say "+3 XP" honestly.
///
/// `promptId` marks this as a reply to an icebreaker (IcebreakerCard.tsx), which should
/// always count even if short, since responding to one at all is the "real effort" signal
/// rather than length or turn-taking. That exemption is granted at most once per person
/// per prompt, and only after Stream confirms the message really is that person's reply
/// to that prompt - see promptReplyIsUnclaimed. A second answer to the same prompt, or a
/// forged one, falls back to the normal checks rather than being refused outright.
export async function awardConfidenceForMessage(
    userId: string,
    channelCid: string,
    messageId: string,
    text: string,
    promptId?: string,
): Promise<AwardResult | null> {
    const guaranteed = promptId
        ? await promptReplyIsUnclaimed(userId, messageId, promptId)
        : false;

    if (!guaranteed && !(await isGenuineBackAndForth(channelCid, messageId, userId, text))) {
        return null;
    }

    const day = utcDay();
    const members = await channelMemberIds(channelCid);

    return prisma.$transaction(async (tx) => {
        // Counted before anything is paid, and counted even once the cap has stopped the
        // payments: this tally is also what the bonus threshold reads, and a chat whose
        // threshold sits above the cap could never reach its own bonus if the counter
        // stopped climbing.
        const activity = await tx.daily_chat_activity.upsert({
            where: {
                channel_cid_profile_id_day: { channel_cid: channelCid, profile_id: userId, day },
            },
            create: {
                channel_cid: channelCid,
                profile_id: userId,
                day,
                qualifying_messages: 1,
            },
            update: { qualifying_messages: { increment: 1 } },
            select: { qualifying_messages: true },
        });

        // An icebreaker answer ignores the cap - it is already limited to once per prompt
        // by prompt_awards, so it cannot be ground out the way ordinary chatter can.
        const messageXp = guaranteed
            ? XP_PER_PROMPT_ANSWER
            : activity.qualifying_messages <= DAILY_MESSAGE_XP_CAP
              ? XP_PER_MESSAGE
              : 0;

        const bonus = await claimDailyBonus(tx, {
            channelCid,
            day,
            members,
            senderId: userId,
            senderTally: activity.qualifying_messages,
        });

        // The sender's personal total takes both halves; the CHANNEL's total takes only
        // the message half, because claimDailyBonus has already added the bonus to it.
        // The chat is one shared number - the bonus lands on it once, not once per member.
        const senderXp = messageXp + (bonus?.perMember ?? 0);

        const profile = await tx.profiles.update({
            where: { id: userId },
            data: { confidence_points: { increment: senderXp } },
            select: { confidence_points: true, confidence_level: true },
        });

        const newTier = tierForPoints(profile.confidence_points ?? 0);
        const tierUp = newTier > profile.confidence_level;

        if (tierUp) {
            const unlockedBadges = await tx.badges.findMany({
                where: { tierRequirement: { lte: newTier } },
            });

            for (const badge of unlockedBadges) {
                await tx.profile_badges.upsert({
                    where: { profile_id_badge_id: { profile_id: userId, badge_id: badge.id } },
                    create: { profile_id: userId, badge_id: badge.id },
                    update: {},
                });
            }

            await tx.profiles.update({
                where: { id: userId },
                data: { confidence_level: newTier },
            });
        }

        const channel = await tx.channel_xp.upsert({
            where: { channel_cid: channelCid },
            create: { channel_cid: channelCid, xp: messageXp },
            update: { xp: { increment: messageXp } },
            select: { xp: true },
        });

        return {
            xpAwarded: senderXp,
            messageXp,
            bonusXp: bonus?.perMember ?? 0,
            dailyBonusEarned: !!bonus,
            channelXp: channel.xp,
            confidencePoints: profile.confidence_points ?? 0,
            confidenceLevel: tierUp ? newTier : profile.confidence_level,
            tierUp,
        };
    });
}

/// Everyone in the channel, from Stream rather than from our own tables.
///
/// Stream owns membership: a 1:1 has no row in group_members at all, so asking Postgres
/// would silently report an empty channel and hand out the bonus to nobody. The Kindred
/// bot posts prompts but is never a member, so nothing needs filtering out.
async function channelMemberIds(channelCid: string): Promise<string[]> {
    const [channelType, channelId] = channelCid.split(":");
    const channel = streamServerClient.channel(channelType, channelId);
    const { members } = await channel.query({ members: { limit: 100 } });

    return (members ?? [])
        .map((member) => member.user_id ?? member.user?.id)
        .filter((id): id is string => !!id);
}

/// Pays the chat's "everyone showed up today" bonus, once, if it has just been earned.
///
/// Returns null when the bonus is not due or was already taken, and the per-member amount
/// when this call is the one that claimed it. Runs inside the caller's transaction so the
/// claim and the payouts cannot come apart.
async function claimDailyBonus(
    tx: Prisma.TransactionClient,
    {
        channelCid,
        day,
        members,
        senderId,
        senderTally,
    }: {
        channelCid: string;
        day: Date;
        members: string[];
        senderId: string;
        senderTally: number;
    },
): Promise<{ perMember: number } | null> {
    if (members.length === 0) return null;

    // Read the level BEFORE this award lands, so a bonus large enough to level the chat up
    // cannot move the goalposts it was just measured against.
    const channel = await tx.channel_xp.findUnique({
        where: { channel_cid: channelCid },
        select: { xp: true },
    });
    const chatLevel = getChatLevel(channel?.xp ?? 0).level;
    const threshold = dailyBonusThreshold(chatLevel);

    // Cheapest check first: if the person who just spoke is not there yet, nobody is.
    if (senderTally < threshold) return null;

    const tallies = await tx.daily_chat_activity.findMany({
        where: { channel_cid: channelCid, day, profile_id: { in: members } },
        select: { profile_id: true, qualifying_messages: true },
    });

    const met = new Set(
        tallies
            .filter((row) => row.qualifying_messages >= threshold)
            .map((row) => row.profile_id),
    );

    // Every member, per the rule: one quiet person holds the bonus for everyone, which is
    // what makes it mean "the whole chat showed up" rather than "two of us did".
    if (!members.every((id) => met.has(id))) return null;

    const perMember = dailyBonusXp(chatLevel);

    try {
        // The insert is the claim. Two members finishing at the same instant both reach
        // here; the composite primary key means exactly one wins and the other reads as
        // already-awarded, the same guarantee promptReplyIsUnclaimed relies on.
        await tx.daily_bonus_awards.create({
            data: { channel_cid: channelCid, day, xp_awarded: perMember },
        });
    } catch {
        return null;
    }

    // The chat's shared total moves once...
    await tx.channel_xp.upsert({
        where: { channel_cid: channelCid },
        create: { channel_cid: channelCid, xp: perMember },
        update: { xp: { increment: perMember } },
    });

    // ...while every OTHER member's personal total moves individually. The sender is
    // excluded deliberately: the caller folds this bonus into their single increment so
    // it can report their new total, and paying them here as well would double it.
    //
    // updateMany rather than update: a member could have deleted their profile between
    // the Stream membership read and this write, and update() would throw and roll back
    // the whole award over one missing row.
    for (const memberId of members.filter((id) => id !== senderId)) {
        await tx.profiles.updateMany({
            where: { id: memberId },
            data: { confidence_points: { increment: perMember } },
        });
    }

    return { perMember };
}

/// Whether this really is `userId`'s first answer to `promptId`, claiming it if so.
///
/// Everything the caller knows comes from the request body, which is attacker-controlled:
/// on its own, "this was a prompt reply" is a claim anyone can make about any message to
/// mint the guaranteed award. So the message is fetched back from Stream - the system of
/// record - and has to actually be this user's, actually be a prompt_response, and
/// actually name this prompt.
///
/// The insert is the claim: the composite primary key means a replayed or repeated award
/// loses the race and lands here as P2002, whether it arrives a second later or a week.
async function promptReplyIsUnclaimed(
    userId: string,
    messageId: string,
    promptId: string,
): Promise<boolean> {
    try {
        const { message } = await streamServerClient.getMessage(messageId);

        if (
            message.user?.id !== userId ||
            message.messageType !== "prompt_response" ||
            message.promptId !== promptId
        ) {
            return false;
        }
    } catch {
        // Can't reach Stream to confirm - decline the exemption rather than hand it out
        // unverified. The message still earns XP the ordinary way if it qualifies.
        return false;
    }

    try {
        await prisma.prompt_awards.create({
            data: { prompt_id: promptId, profile_id: userId },
        });
        return true;
    } catch {
        // Already claimed (P2002 on the composite key). Prisma 7's driver adapters dropped
        // error.meta.target, so there is nothing more specific to match on here.
        return false;
    }
}

async function isGenuineBackAndForth(
    channelCid: string,
    messageId: string,
    userId: string,
    text: string,
): Promise<boolean> {
    if (text.trim().length < MIN_MESSAGE_LENGTH) return false;

    const [channelType, channelId] = channelCid.split(":");
    const channel = streamServerClient.channel(channelType, channelId);
    const { messages } = await channel.query({ messages: { limit: 5 } });

    // Messages come back oldest-first. Exclude the message we're scoring itself, then
    // the last one remaining is the most recent message that came before it.
    const previousMessage = messages.filter((m) => m.id !== messageId).at(-1);

    return !!previousMessage && previousMessage.user?.id !== userId;
}
