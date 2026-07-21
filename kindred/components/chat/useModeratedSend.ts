"use client";

import { useCallback, useEffect, useState } from "react";
import { useChannelStateContext, useChatContext } from "stream-chat-react";

import { acceptRequest } from "@/app/(app)/chats/actions";
import { useToast, type ToastInput } from "@/components/ui/ToastStack";
import type { AwardResult } from "@/lib/confidence";
import { getChatLevel } from "@/lib/chat-level";

// The two halves of sending a message that have nothing to do with Stream's composer:
// the moderation check that runs before a send, and the bookkeeping that runs after one.
//
// This lives in a hook rather than inside ModeratedMessageComposer because there are now
// two places a message can originate - the composer at the bottom of the window, and the
// input inside an icebreaker card (IcebreakerCard.tsx). Duplicating the pipeline would
// mean a message sent from the card skipping moderation entirely, which is the one thing
// that must never differ between the two.
//
// Must be rendered inside <Channel> - it reads channel and client from context.

// How the caller should describe a block to the user. The copy lives here so both
// surfaces say the same thing; only the chrome around it differs.
export type ModerationNotice = {
    kind: "cooldown" | "warning";
    text: string;
};

export function useModeratedSend() {
    const { channel } = useChannelStateContext();
    const { client } = useChatContext();
    const { showToast } = useToast();
    const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [showWarning, setShowWarning] = useState(false);

    // Ticks the countdown once a cooldown is active, and clears itself once it expires.
    useEffect(() => {
        if (!cooldownUntil) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining === 0) setCooldownUntil(null);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [cooldownUntil]);

    // The first couple of flagged messages are warning-only (no cooldownUntil from the
    // route) - show the warning for a few seconds rather than leaving it up forever.
    useEffect(() => {
        if (!showWarning) return;
        const timeout = setTimeout(() => setShowWarning(false), 6000);
        return () => clearTimeout(timeout);
    }, [showWarning]);

    const moderate = useCallback(async (text: string): Promise<{ blocked: boolean }> => {
        if (!text.trim()) return { blocked: false };

        let flagged = false;
        let newCooldownUntil: number | null = null;

        try {
            const res = await fetch("/api/moderate-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            if (res.ok) {
                const data = await res.json();
                flagged = data.flagged;
                newCooldownUntil = data.cooldownUntil ?? null;
            }
            // A non-ok response here is treated the same as flagged: false - fail open,
            // same policy as the route itself uses for the OpenAI call.
        } catch {
            // Network error reaching our own route - fail open.
        }

        if (!flagged) return { blocked: false };

        if (newCooldownUntil) {
            setCooldownUntil(newCooldownUntil);
        } else {
            setShowWarning(true);
        }

        return { blocked: true };
    }, []);

    // Turns an award into what the user sees. XP toasts coalesce under one mergeKey so a
    // fast exchange accumulates ("+1" then "+2") instead of stacking a toast per message;
    // a tier-up gets its own toast rather than being buried in that running total, since
    // it happens rarely and means considerably more.
    const announceAward = useCallback(
        (award: AwardResult) => {
            const xpToast = (total: number): ToastInput => ({
                kind: "xp",
                title: `+${total} XP`,
                body: `Chat level ${getChatLevel(award.channelXp).level} · ${award.confidencePoints} confidence pts`,
                count: total,
                mergeKey: "xp",
                merge: (previous) => xpToast((previous.count ?? 0) + award.xpAwarded),
            });

            showToast(xpToast(award.xpAwarded));

            if (award.tierUp) {
                showToast({
                    kind: "milestone",
                    title: `Confidence Tier ${award.confidenceLevel}`,
                    body: "New badges unlocked on your profile.",
                });
            }
        },
        [showToast],
    );

    // Everything that has to happen after a message is already in the channel. Never
    // throws: by the time this runs the message has gone through, so a failure here must
    // not look to the sender like the send failed.
    const finalizeSend = useCallback(
        async ({
            cid,
            messageId,
            text,
            promptId,
        }: {
            cid: string;
            messageId: string;
            text: string;
            promptId?: string;
        }) => {
            // Replying IS accepting: clearing requested_of moves the conversation out of
            // Pending for both people. Only the recipient can do it — for the sender,
            // requested_of names the other person, so this is a no-op on their side and
            // their own wave stays pending until it's answered.
            //
            // After the send, not before: a message blocked by moderation should leave the
            // request exactly as it was. The action re-checks ownership server-side, so a
            // stale channel here can't accept anything it shouldn't.
            if (channel?.data?.requested_of === client.userID && channel.id) {
                const formData = new FormData();
                // channel.id, not cid — acceptChatRequest queries Stream by id.
                formData.set("channel_id", channel.id);
                await acceptRequest(formData);
            }

            // Best-effort, background signal for confidence_level growth - never
            // awaited in a way that could delay or fail the send itself.
            if (text.trim()) {
                fetch("/api/confidence", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ channelCid: cid, messageId, text, promptId }),
                })
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data: { award: AwardResult | null } | null) => {
                        const award = data?.award;
                        // Not every message earns something - a short one, or a second in
                        // a row, qualifies for nothing. Firing on any 200 (what this used
                        // to do) told the badge to refetch a number that hadn't moved and
                        // would have made an XP toast lie.
                        if (!award) return;

                        // Tell ChatXpBadge (both participants') the award has landed and
                        // it's safe to refetch, rather than making it guess how long.
                        channel.sendEvent({ type: "chat_xp_updated" });

                        announceAward(award);
                    })
                    .catch(() => {});
            }
        },
        [channel, client.userID, announceAward],
    );

    const notice: ModerationNotice | null =
        cooldownUntil && secondsLeft > 0
            ? {
                  kind: "cooldown",
                  text: `Please keep this chat respectful — offensive language isn't allowed here, and repeated violations may result in restrictions on your account. You can send messages again in ${secondsLeft}s.`,
              }
            : showWarning
              ? {
                    kind: "warning",
                    text: "That message wasn't sent — please keep this chat respectful. Continuing to send offensive messages will temporarily restrict you from chatting.",
                }
              : null;

    return { moderate, finalizeSend, notice };
}