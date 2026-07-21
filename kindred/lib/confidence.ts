import "server-only";

import { prisma } from "@/lib/prisma";
import { streamServerClient } from "@/lib/stream";
import { tierForPoints } from "@/lib/confidence-tiers";

// Below this, a message doesn't count as "real effort" - filters out "ok", "lol",
// single emoji, etc. Chosen to be generous rather than strict for v1.
const MIN_MESSAGE_LENGTH = 15;

/// Awards +1 to both profiles.confidence_points (the sender's own, global, per-person
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
/// Silently does nothing if either condition isn't met. This is a background signal,
/// never something that should surface an error to the sender - callers should not
/// await this in a way that blocks or fails the actual message send.
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
): Promise<void> {
    const guaranteed = promptId
        ? await promptReplyIsUnclaimed(userId, messageId, promptId)
        : false;

    if (!guaranteed && !(await isGenuineBackAndForth(channelCid, messageId, userId, text))) return;

    await prisma.$transaction(async (tx) => {
        const profile = await tx.profiles.update({
            where: { id: userId },
            data: { confidence_points: { increment: 1 } },
            select: { confidence_points: true, confidence_level: true },
        });

        const newTier = tierForPoints(profile.confidence_points ?? 0);
        if (newTier > profile.confidence_level) {
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

        await tx.channel_xp.upsert({
            where: { channel_cid: channelCid },
            create: { channel_cid: channelCid, xp: 1 },
            update: { xp: { increment: 1 } },
        });
    });
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
