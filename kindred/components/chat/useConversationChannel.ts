"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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
const MOVE_EVENT = "game-move";

/// How long since a tab last announced itself before its owner counts as idle.
const IDLE_AFTER_MS = 2 * 60 * 1000;

/// How often a visible tab re-announces. Well under IDLE_AFTER_MS so somebody reading without
/// touching anything still reads as active — and a hidden or closed tab simply stops sending,
/// which is what lets them fall to idle without needing to say goodbye.
const HEARTBEAT_EVERY_MS = 45 * 1000;

/// Where someone is, as far as THIS conversation can honestly tell.
///
/// Deliberately not "offline". The channel is per-conversation, so it knows who has this chat
/// open and nothing else: somebody reading a different conversation two feet away looks
/// identical to somebody who shut their laptop. "Away" claims only what is known.
///
/// Real app-wide offline needs a last_seen_at table and a heartbeat that writes — a decision
/// deferred deliberately, partly on cost and partly because "online and not replying to me"
/// is the exact anxiety this app exists to reduce.
export type PresenceStatus = "active" | "idle" | "away";

export type ConversationChannel = {
    /// Profile ids of everyone else with this conversation open, active or idle.
    presentIds: string[];
    /// Where one other member is. Anyone the channel cannot see is "away".
    statusOf: (profileId: string) => PresenceStatus;
    /// Profile ids of everyone else currently typing.
    typingIds: string[];
    /// Called on every keystroke. Throttles internally, so callers do not have to.
    reportTyping: () => void;
    /// Tells the other player a move landed. The move is already saved by then — this only
    /// saves them waiting to find out, so a dropped broadcast means a board that is stale
    /// until its next load rather than one that disagrees with the database.
    reportMove: (sessionId: string) => void;
    /// Fires when the other player moves, with the session it happened in.
    onMove: (listener: (sessionId: string) => void) => () => void;
};

export function useConversationChannel(
    conversationId: string,
    userId: string,
): ConversationChannel {
    /// Profile id -> when their tab last announced itself. Present at all means they have
    /// this conversation open; how recently decides active against idle.
    const [activeAt, setActiveAt] = useState<Record<string, number>>({});
    /// Profile id -> the moment their typing signal goes stale.
    const [typingUntil, setTypingUntil] = useState<Record<string, number>>({});

    /// Bumped on a timer so a status that has gone stale re-renders. Nothing arrives when
    /// someone STOPS being active — they simply stop announcing — so the passage of time is
    /// the only thing that can move them from active to idle.
    const [, setTick] = useState(0);

    // Held in a ref so reportTyping can reach the channel without being rebuilt — and so a
    // keystroke never re-renders anything just to find where to send.
    const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
    const lastBroadcastRef = useRef(0);

    // Same reason as the channel itself: a board subscribing should not tear down and rebuild
    // the socket, and there can be more than one board open in a group.
    const moveListenersRef = useRef(new Set<(sessionId: string) => void>());

    useEffect(() => {
        const supabase = createClient();
        const channel = supabase.channel(conversationId, {
            config: { private: true, presence: { key: userId } },
        });
        channelRef.current = channel;

        channel
            .on("presence", { event: "sync" }, () => {
                // presenceState is keyed by the presence key set above, so the keys ARE the
                // profile ids. The payload carries when that tab last announced itself.
                const state = channel.presenceState<{ activeAt?: number }>();

                const next: Record<string, number> = {};
                for (const [profileId, entries] of Object.entries(state)) {
                    if (profileId === userId) continue;
                    // Someone can be present from more than one tab. The most recent one is
                    // the honest answer — a phone left open should not drag a laptop that is
                    // actively being used down to idle.
                    next[profileId] = Math.max(...entries.map((e) => e.activeAt ?? 0));
                }

                setActiveAt(next);
            })
            .on("broadcast", { event: TYPING_EVENT }, ({ payload }) => {
                const typistId = (payload as { userId?: string }).userId;
                if (!typistId || typistId === userId) return;

                setTypingUntil((current) => ({
                    ...current,
                    [typistId]: Date.now() + TYPING_EXPIRES_AFTER_MS,
                }));
            })
            .on("broadcast", { event: MOVE_EVENT }, ({ payload }) => {
                const { sessionId, userId: moverId } = payload as {
                    sessionId?: string;
                    userId?: string;
                };
                if (!sessionId || moverId === userId) return;

                for (const listener of moveListenersRef.current) listener(sessionId);
            })
            .subscribe((status) => {
                // track() has to wait for the join to be accepted; calling it earlier is
                // silently dropped, which shows up as "nobody is ever present".
                if (status === "SUBSCRIBED") void channel.track({ userId, activeAt: Date.now() });
            });

        // Re-announce while the tab is actually being looked at.
        //
        // The whole three-state model rests on this: a visible tab keeps refreshing its
        // timestamp, a hidden or closed one silently stops, and everyone else works out the
        // difference from how stale it has gone. Nothing has to detect a departure, which is
        // what makes a killed browser resolve itself.
        const announce = () => {
            if (document.visibilityState !== "visible") return;
            void channel.track({ userId, activeAt: Date.now() });
        };

        const heartbeat = setInterval(announce, HEARTBEAT_EVERY_MS);
        // Immediately on return, so coming back to the tab does not leave you looking idle
        // to the other person for most of a minute.
        document.addEventListener("visibilitychange", announce);

        return () => {
            clearInterval(heartbeat);
            document.removeEventListener("visibilitychange", announce);
            channelRef.current = null;
            void supabase.removeChannel(channel);
        };
    }, [conversationId, userId]);

    // Moves people from active to idle as their announcements age. Only runs while somebody
    // is present, so an empty conversation costs no timer.
    const someoneIsPresent = Object.keys(activeAt).length > 0;
    useEffect(() => {
        if (!someoneIsPresent) return;

        const interval = setInterval(() => setTick((n) => n + 1), 15_000);
        return () => clearInterval(interval);
    }, [someoneIsPresent]);

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

    const reportMove = useCallback(
        (sessionId: string) => {
            void channelRef.current?.send({
                type: "broadcast",
                event: MOVE_EVENT,
                payload: { sessionId, userId },
            });
        },
        [userId],
    );

    const onMove = useCallback((listener: (sessionId: string) => void) => {
        moveListenersRef.current.add(listener);
        return () => {
            moveListenersRef.current.delete(listener);
        };
    }, []);

    const statusOf = useCallback(
        (profileId: string): PresenceStatus => {
            const lastSeen = activeAt[profileId];
            if (!lastSeen) return "away";
            return Date.now() - lastSeen < IDLE_AFTER_MS ? "active" : "idle";
        },
        [activeAt],
    );

    return {
        presentIds: Object.keys(activeAt),
        statusOf,
        typingIds: Object.keys(typingUntil),
        reportTyping,
        reportMove,
        onMove,
    };
}

// A game board sits inside a message, inside the timeline — three levels below the component
// that owns the channel. Passing reportMove down through MessageBubble would mean teaching it
// that games exist, which is a lot to ask of something whose job is drawing a bubble.
const ConversationChannelContext = createContext<ConversationChannel | null>(null);

export const ConversationChannelProvider = ConversationChannelContext.Provider;

/// The open conversation's channel. Only valid inside a Thread.
export function useChannel(): ConversationChannel {
    const channel = useContext(ConversationChannelContext);
    if (!channel) {
        throw new Error("useChannel must be used inside a Thread's ConversationChannelProvider");
    }
    return channel;
}
