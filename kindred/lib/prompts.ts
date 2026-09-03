import "server-only";

import { sendMessage } from "@/lib/chat/mutations";
import { prisma } from "@/lib/prisma";

const ICEBREAKER_PROMPTS = [
    "What's a hobby you picked up recently that surprised you?",
    "What's the best piece of advice you've ever gotten?",
    "If you could instantly master any skill, what would it be?",
    "What's a small thing that always makes your day better?",
    "What's something you're looking forward to this month?",
    "What's a show or movie you could rewatch forever?",
    "What's your go-to comfort food?",
    "If you had a free weekend with no plans, what would you do?",
    "What's a place you'd love to visit someday?",
    "What's something you're weirdly good at?",
    "What's a song that always puts you in a good mood?",
    "What's the last thing that made you laugh out loud?",
    "Coffee, tea, or neither?",
    "What's a game you could play for hours?",
    "What's something you learned recently that stuck with you?",
];

/// Posts one random icebreaker into a conversation, as the Kindred bot.
///
/// The bot is the absence of a sender, not a user: a profiles row needs an auth.users row
/// behind it, and the bot has no account. sendMessage takes senderId: null for exactly this,
/// which also means the post skips the membership check and moderation — both correct, since
/// the text comes from the list above rather than from anyone.
export async function postIcebreakerPrompt(conversationId: string): Promise<void> {
    const text = ICEBREAKER_PROMPTS[Math.floor(Math.random() * ICEBREAKER_PROMPTS.length)];

    await sendMessage({
        conversationId,
        senderId: null,
        kind: "icebreaker_prompt",
        body: text,
    });
}

/// Whether this user has ever answered an icebreaker - the "Open Book" badge.
///
/// Reads prompt_awards rather than counting prompt_response messages: lib/confidence.ts
/// writes exactly one row there per person per prompt, and that table is already the
/// record of an answer that counted. Counting messages would also recognize an answer
/// that was later deleted.
export async function hasAnsweredAnIcebreaker(profileId: string): Promise<boolean> {
    const count = await prisma.prompt_awards.count({ where: { profile_id: profileId } });
    return count > 0;
}
