"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";

// Who has this conversation open, and who is typing in it.
//
// Its own channel, separate from the shell's subscription in ChatRealtimeProvider, because
// the two carry different kinds of thing. That one delivers Postgres changes for every
// conversation you are in and has to outlive any particular screen. This one is ephemeral —
// presence and typing are worth knowing for a few seconds and worthless afterwards, so they
// are broadcast and never written down — and it is scoped to the conversation you are looking
// at, which is the only one you can be present in or typing into.
//
// The channel is PRIVATE. Its topic is the conversation id, and the policies added in
// 20260728000000_authorize_conversation_channels only let members join. Public would have
// meant the channel is exactly as private as its id, and conversation ids travel in URLs.

/// How often a keystroke actually reaches the wire. Typing fires on every character; this is
/// what stops that becoming a message per character.
const BROADCAST_TYPING_EVERY_MS = 2_000;

/// How long a typing signal stands before the typist is assumed to have stopped. Comfortably
/// more than the broadcast interval, so an ordinary pause mid-sentence does not flicker.
const TYPING_EXPIRES_AFTER_MS = 5_000;

const TYPING_EVENT = "typing";

export type ConversationChannel = {
    /// Profile ids of everyone else with this conversation open.
    presentIds: string[];
    /// Profile ids of everyone else currently typing.
    typingIds: string[];
    /// Called on every keystroke. Throttles internally, so callers do not have to.
    reportTyping: () => void;
};

export function useConversationChannel(
    conversationId: string,
    userId: string,
): ConversationChannel {
    const [presentIds, setPresentIds] = useState<string[]>([]);
    /// Profile id -> the moment their typing signal goes stale.
    const [typingUntil, setTypingUntil] = useState<Record<string, number>>({});

    // Held in a ref so reportTyping can reach the channel without being rebuilt — and so a
    // keystroke never re-renders anything just to find where to send.
    const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
    const lastBroadcastRef = useRef(0);

    useEffect(() => {
        const supabase = createClient();
        const channel = supabase.channel(conversationId, {
            config: { private: true, presence: { key: userId } },
        });
        channelRef.current = channel;

        channel
            .on("presence", { event: "sync" }, () => {
                // presenceState is keyed by the presence key set above, so the keys ARE the
                // profile ids and nothing has to be dug out of the payloads.
                const others = Object.keys(channel.presenceState()).filter(
                    (id) => id !== userId,
                );
                setPresentIds(others);
            })
            .on("broadcast", { event: TYPING_EVENT }, ({ payload }) => {
                const typistId = (payload as { userId?: string }).userId;
                if (!typistId || typistId === userId) return;

                setTypingUntil((current) => ({
                    ...current,
                    [typistId]: Date.now() + TYPING_EXPIRES_AFTER_MS,
                }));
            })
            .subscribe((status) => {
                // track() has to wait for the join to be accepted; calling it earlier is
                // silently dropped, which shows up as "nobody is ever present".
                if (status === "SUBSCRIBED") void channel.track({ userId });
            });

        return () => {
            channelRef.current = null;
            void supabase.removeChannel(channel);
        };
    }, [conversationId, userId]);

    // Typing has no "stopped" event: someone who closes the tab mid-sentence would never send
    // one. Instead every signal carries its own expiry and this sweeps the stale ones, which
    // also means a dropped connection resolves itself rather than leaving a ghost typist.
    //
    // Only runs while somebody is typing, so an idle conversation costs no timer at all.
    const someoneIsTyping = Object.keys(typingUntil).length > 0;
    useEffect(() => {
        if (!someoneIsTyping) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUntil((current) => {
                const live = Object.fromEntries(
                    Object.entries(current).filter(([, expiresAt]) => expiresAt > now),
                );
                // Same object back when nothing expired, so an unchanged sweep does not
                // re-render every second for the whole time someone is typing.
                return Object.keys(live).length === Object.keys(current).length ? current : live;
            });
        }, 1_000);

        return () => clearInterval(interval);
    }, [someoneIsTyping]);

    const reportTyping = useCallback(() => {
        const now = Date.now();
        if (now - lastBroadcastRef.current < BROADCAST_TYPING_EVERY_MS) return;
        lastBroadcastRef.current = now;

        void channelRef.current?.send({
            type: "broadcast",
            event: TYPING_EVENT,
            payload: { userId },
        });
    }, [userId]);

    return {
        presentIds,
        typingIds: Object.keys(typingUntil),
        reportTyping,
    };
}
