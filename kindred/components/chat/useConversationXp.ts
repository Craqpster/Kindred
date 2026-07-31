"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadConversationXp } from "@/app/(app)/chats/actions";
import { useChatRealtime } from "@/components/chat/ChatRealtimeProvider";
import { chatLevelToast, dailyBonusToast } from "@/components/chat/sharedToasts";
import { useToast } from "@/components/ui/ToastStack";
import { getChatLevel } from "@/lib/chat-level";
import { dailyBonusThreshold } from "@/lib/confidence-xp";
import type { AwardResult } from "@/lib/confidence";
import type { ConversationXp } from "@/lib/chat/types";

// A conversation's XP, kept current, and the toasts that go with it moving.
//
// Split out of Thread because it is the only part of that component doing arithmetic rather
// than rendering — and because the two ways XP moves have nothing to do with each other, which
// is easier to see when they are not interleaved with the timeline:
//
//   * your own send already returns what it earned, so the badge settles from the response;
//   * somebody else's send moved a total this client cannot see, so it has to ask.
//
// The asking is necessary because `channel_xp` is deliberately NOT in the realtime publication.
// What the socket delivers is the message that moved it, and that is the cue to re-read.

export type ConversationXpState = {
    xp: ConversationXp | null;
    /// Folds an award from your own send into the badge, without a round trip.
    applyAward: (award: AwardResult) => void;
};

export function useConversationXp({
    conversationId,
    userId,
    initialXp,
}: {
    conversationId: string;
    userId: string;
    /// Rendered by the server, so the badge is right at first paint.
    initialXp: ConversationXp | null;
}): ConversationXpState {
    const { onMessage } = useChatRealtime();
    const { showToast } = useToast();
    const [xp, setXp] = useState(initialXp);

    /// The comparison for "did this cross a level" runs against a ref rather than inside the
    /// state updater, because an updater has to stay pure — React may call it twice, and a
    /// toast raised from in there would fire twice with it.
    const xpRef = useRef(initialXp);

    const settle = useCallback(
        (next: ConversationXp) => {
            const previous = xpRef.current;
            xpRef.current = next;
            setXp(next);

            if (previous && next.level > previous.level) {
                showToast(chatLevelToast(next.level));
            }
            if (next.bonusEarnedToday && !previous?.bonusEarnedToday && next.bonusXpToday) {
                showToast(dailyBonusToast(next.bonusXpToday));
            }
        },
        [showToast],
    );

    // Somebody else's message is the only notice this client gets that the total has moved.
    // Own messages are settled by applyAward from what the send already returned, so asking
    // here as well would be a round trip for a number already in hand.
    useEffect(() => {
        return onMessage((row) => {
            if (row.conversation_id !== conversationId) return;
            if (!row.sender_id || row.sender_id === userId) return;

            void loadConversationXp(conversationId).then((next) => {
                if (next) settle(next);
            });
        });
    }, [onMessage, conversationId, userId, settle]);

    /// Every figure here is derived with the same shared functions the award path used —
    /// getChatLevel and dailyBonusThreshold — so this repeats the server's arithmetic rather
    /// than guessing at it. `channelXp` is the authoritative new total; the rest follows.
    ///
    /// qualifying_messages is incremented for exactly the messages that produce an award, so
    /// "+1" is the same rule the row on disk follows rather than an approximation.
    const applyAward = useCallback(
        (award: AwardResult) => {
            const { level, xpIntoLevel, xpForNextLevel } = getChatLevel(award.channelXp);

            settle({
                xp: award.channelXp,
                level,
                xpIntoLevel,
                xpForNextLevel,
                messagesToday: (xpRef.current?.messagesToday ?? 0) + 1,
                bonusThreshold: dailyBonusThreshold(level),
                bonusEarnedToday: xpRef.current?.bonusEarnedToday || award.dailyBonusEarned,
                bonusXpToday: award.dailyBonusEarned
                    ? award.bonusXp
                    : (xpRef.current?.bonusXpToday ?? null),
            });
        },
        [settle],
    );

    return { xp, applyAward };
}
