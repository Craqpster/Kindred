import "server-only";

import { KINDRED_BOT_ID, KINDRED_BOT_NAME } from "@/lib/kindred-bot";
import { streamServerClient } from "@/lib/stream";

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

/// Posts one random icebreaker prompt into the channel identified by `channelCid`, as a
/// message from the Kindred bot user. Server-only since it uses the Stream server client
/// directly - callers are startChatRequest (right when a chat is created) and
/// /api/chat-prompts (on-demand button + the client-side "chat gone quiet" check).
export async function postIcebreakerPrompt(channelCid: string): Promise<void> {
    await streamServerClient.upsertUser({ id: KINDRED_BOT_ID, name: KINDRED_BOT_NAME });

    const [channelType, channelId] = channelCid.split(":");
    const channel = streamServerClient.channel(channelType, channelId);

    const text = ICEBREAKER_PROMPTS[Math.floor(Math.random() * ICEBREAKER_PROMPTS.length)];

    await channel.sendMessage({
        text,
        user_id: KINDRED_BOT_ID,
        messageType: "icebreaker_prompt",
    });
}
