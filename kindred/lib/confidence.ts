import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { getChatLevel } from "@/lib/chat-level";
import {
    dailyBonusThreshold,
    dailyBonusXp,
    DAILY_MESSAGE_XP_CAP,
    utcDay,
    XP_PER_MESSAGE,
    XP_PER_PROMPT_ANSWER,
} from "@/lib/confidence-xp";
import { prisma } from "@/lib/prisma";
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
/// per prompt, and at most once per chat per day - see promptReplyIsUnclaimed. A second
/// answer falls back to the normal checks rather than being refused outright.
///
/// Only ever called from lib/chat/mutations.ts's sendMessage, which has just written the
/// message itself. That is what retired the old anti-forgery step: this used to be reachable
/// through POST /api/confidence with a body the caller chose, so it had to fetch the message
/// back out of Stream and prove the claim before paying anything. There is no longer a
/// request to forge.
///
/// Named arguments: this took five positional strings, and passing a conversation id where a
/// Stream channel id belonged type-checked cleanly and wrote to the wrong column. Nothing
/// about `(string, string, string, string, string?)` could have caught that.
export async function awardConfidenceForMessage({
    userId,
    conversationId,
    messageId,
    text,
    promptId,
}: {
    userId: string;
    conversationId: string;
    messageId: string;
    text: string;
    promptId?: string;
}): Promise<AwardResult | null> {
    const guaranteed = promptId
        ? await promptReplyIsUnclaimed({ userId, promptId, conversationId })
        : false;

    if (
        !guaranteed &&
        !(await isGenuineBackAndForth({ conversationId, messageId, userId, text }))
    ) {
        return null;
    }

    const day = utcDay();
    const members = await conversationMemberIds(conversationId);

    return prisma.$transaction(async (tx) => {
        // Counted before anything is paid...
        const activity = await tx.daily_chat_activity.upsert({
            where: {
                conversation_id_profile_id_day: {
                    conversation_id: conversationId,
                    profile_id: userId,
                    day,
                },
            },
            create: {
                conversation_id: conversationId,
                profile_id: userId,
                day,
                qualifying_messages: 1,
            },
            update: { qualifying_messages: { increment: 1 } },
            select: { qualifying_messages: true },
        });

        // An icebreaker answer ignores the cap...
        const messageXp = guaranteed
            ? XP_PER_PROMPT_ANSWER
            : activity.qualifying_messages <= DAILY_MESSAGE_XP_CAP
              ? XP_PER_MESSAGE
              : 0;

        const bonus = await claimDailyBonus(tx, {
            conversationId,
            day,
            members,
            senderId: userId,
            senderTally: activity.qualifying_messages,
        });

        // The sender's personal total takes both halves...
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
            where: { conversation_id: conversationId },
            create: { conversation_id: conversationId, xp: messageXp },
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

/// Everyone in the conversation.
///
/// This used to be an API call to Stream, with a comment explaining that Postgres could not
/// answer it - a DM had no row in group_members, so asking our own database reported an empty
/// room and paid the bonus to nobody. conversation_members covers DMs and groups alike, so
/// the question is now a single indexed read. The Kindred bot posts prompts but is never a
/// member, so nothing needs filtering out.
async function conversationMemberIds(conversationId: string): Promise<string[]> {
    const members = await prisma.conversation_members.findMany({
        where: { conversation_id: conversationId },
        select: { profile_id: true },
    });

    return members.map((member) => member.profile_id);
}

/// Pays the chat's "everyone showed up today" bonus, once, if it has just been earned.
///
/// Returns null when the bonus is not due or was already taken, and the per-member amount
/// when this call is the one that claimed it. Runs inside the caller's transaction so the
/// claim and the payouts cannot come apart.
async function claimDailyBonus(
    tx: Prisma.TransactionClient,
    {
        conversationId,
        day,
        members,
        senderId,
        senderTally,
    }: {
        conversationId: string;
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
        where: { conversation_id: conversationId },
        select: { xp: true },
    });
    const chatLevel = getChatLevel(channel?.xp ?? 0).level;
    const threshold = dailyBonusThreshold(chatLevel);

    // Cheapest check first: if the person who just spoke is not there yet, nobody is.
    if (senderTally < threshold) return null;

    const tallies = await tx.daily_chat_activity.findMany({
        where: { conversation_id: conversationId, day, profile_id: { in: members } },
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
            data: { conversation_id: conversationId, day, xp_awarded: perMember },
        });
    } catch {
        return null;
    }

    // The chat's shared total moves once...
    await tx.channel_xp.upsert({
        where: { conversation_id: conversationId },
        create: { conversation_id: conversationId, xp: perMember },
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

/// Whether this really is `userId`'s first answer to `promptId` today, claiming it if so.
///
/// Two separate limits, and they are not the same rule. prompt_awards stops one prompt from
/// ever paying the same person twice - a guarantee that has to hold forever, which is why it
/// is a row and not a query. The daily check stops someone farming the exemption by asking
/// for a fresh prompt every few minutes and answering each one.
///
/// The insert IS the claim: the composite primary key means a repeat loses the race and
/// lands here as a unique violation, whether it arrives a second later or a week.
async function promptReplyIsUnclaimed({
    userId,
    promptId,
    conversationId,
}: {
    userId: string;
    promptId: string;
    conversationId: string;
}): Promise<boolean> {
    const alreadyAnsweredToday = await prisma.messages.findFirst({
        where: {
            conversation_id: conversationId,
            sender_id: userId,
            kind: "prompt_response",
            created_at: { gte: utcDay() },
            // The message being scored was written moments ago and is already in the table,
            // so it has to be excluded or it would count as its own earlier answer.
            prompt_id: { not: promptId },
        },
        select: { id: true },
    });

    if (alreadyAnsweredToday) return false;

    try {
        await prisma.prompt_awards.create({
            data: { prompt_id: promptId, profile_id: userId },
        });
        return true;
    } catch {
        // Already claimed this exact prompt before (a unique violation on the composite key).
        return false;
    }
}

/// A message counts when it took some effort AND answers someone - not when it is the fifth
/// thing said into a silence.
///
/// One indexed read now. This used to pull the last five messages out of Stream over HTTP,
/// which was the single clearest sign that the interactions and the score lived in two
/// different systems.
async function isGenuineBackAndForth({
    conversationId,
    messageId,
    userId,
    text,
}: {
    conversationId: string;
    messageId: string;
    userId: string;
    text: string;
}): Promise<boolean> {
    if (text.trim().length < MIN_MESSAGE_LENGTH) return false;

    const previousMessage = await prisma.messages.findFirst({
        where: {
            conversation_id: conversationId,
            // Everything before the message being scored, which is already written.
            id: { not: messageId },
            deleted_at: null,
        },
        orderBy: { created_at: "desc" },
        select: { sender_id: true },
    });

    // The bot's icebreaker counts as somebody else having spoken, which is the point of
    // posting one into a quiet chat.
    return !!previousMessage && previousMessage.sender_id !== userId;
}
