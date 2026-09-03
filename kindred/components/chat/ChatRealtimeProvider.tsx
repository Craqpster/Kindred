"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { ReactNode } from "react";

import { loadConversation } from "@/app/(app)/chats/actions";
import { useToast } from "@/components/ui/ToastStack";
import type { ChatConversation } from "@/lib/chat/types";
import { isReactionPresent } from "@/lib/chat/realtime";
import type { MessageRow, ReactionRow } from "@/lib/chat/realtime";
import { createClient } from "@/utils/supabase/client";

// One Supabase subscription for the whole authenticated shell.
//
// Mounted where Stream's provider used to be, and for the same reason: unread badges and
// new-message toasts have to work from /meet, not only while /chats is open. Connecting per
// visit was what made the old implementation racy.
//
// The subscription is UNFILTERED on purpose. postgres_changes filters support one
// `column=eq.value`, so "messages in any of my conversations" is not expressible as a filter
// — RLS does that job instead, evaluated per subscriber against the policies in
// 20260725000000_add_chat_tables. This is also why the browser needs its SELECT grant: a
// policy is only consulted once a grant has let the table be touched.
//
// Scaling note, so nobody rediscovers it: unfiltered changes mean Realtime evaluates RLS per
// subscriber per change, which Supabase puts in the low hundreds of concurrent subscribers.
// Far above where this app is. The escape hatch is broadcast-from-database
// (realtime.broadcast_changes() in a trigger, fanned out to a per-user topic).

type ChatRealtimeValue = {
    conversations: ChatConversation[];
    /// Fires for every message row that arrives for a conversation this user is in.
    /// The open thread subscribes to this rather than opening a second connection.
    onMessage: (listener: (row: MessageRow) => void) => () => void;
    /// Fires when anyone reacts or un-reacts. `present` is whether the reaction exists
    /// afterwards, so a listener can apply it without tracking which event it was.
    onReaction: (listener: (row: ReactionRow, present: boolean) => void) => () => void;
    /// True once the socket has actually joined. Until then a message could be missed, which
    /// the UI can use to decide whether it still needs to poll on focus.
    connected: boolean;
    /// Tells the shell which conversation is on screen, so it can stop announcing messages
    /// the user is already looking at. Null when no conversation is open.
    setOpenConversation: (conversationId: string | null) => void;
};

const ChatRealtimeContext = createContext<ChatRealtimeValue | null>(null);

export function useChatRealtime() {
    const value = useContext(ChatRealtimeContext);
    if (!value) throw new Error("useChatRealtime must be used inside ChatRealtimeProvider");
    return value;
}

export default function ChatRealtimeProvider({
    userId,
    initialConversations,
    children,
}: {
    userId: string;
    /// Rendered by the server on first load, then kept current here. Seeding from the server
    /// means the list is correct before the socket has even connected.
    initialConversations: ChatConversation[];
    children: ReactNode;
}) {
    const [conversations, setConversations] = useState(initialConversations);
    const [connected, setConnected] = useState(false);
    const { showToast } = useToast();

    // Listeners live in a ref so that subscribing does not re-render this provider, and so
    // the socket effect below does not tear down and rebuild every time a thread mounts.
    const listenersRef = useRef(new Set<(row: MessageRow) => void>());

    /// Which conversation is on screen, so an arriving message can decide whether announcing
    /// itself would be telling the user something they can already see.
    const openConversationRef = useRef<string | null>(null);

    /// The list as the socket handlers need to read it. The subscription is built once, so it
    /// closes over whatever `conversations` was at mount — a ref is what lets a handler see
    /// the current one without rebuilding the socket every time a message arrives.
    ///
    /// Synced in an effect rather than assigned during render: a ref write during render is
    /// unsafe once React can render speculatively, and the compiler rejects it. Being one
    /// commit behind costs nothing here, because the only reader is a name lookup for a toast.
    const conversationsRef = useRef(conversations);
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);
    const reactionListenersRef = useRef(
        new Set<(row: ReactionRow, present: boolean) => void>(),
    );

    const onMessage = useMemo(
        () => (listener: (row: MessageRow) => void) => {
            listenersRef.current.add(listener);
            return () => {
                listenersRef.current.delete(listener);
            };
        },
        [],
    );

    const onReaction = useMemo(
        () => (listener: (row: ReactionRow, present: boolean) => void) => {
            reactionListenersRef.current.add(listener);
            return () => {
                reactionListenersRef.current.delete(listener);
            };
        },
        [],
    );

    /// Who sent a message, by looking them up among the members this client already holds.
    /// Returns null for the Kindred bot and for anyone the list has not caught up with yet,
    /// which the caller falls back on rather than guessing a name.
    const nameOf = (senderId: string, conversationId: string): string | null => {
        const conversation = conversationsRef.current.find((c) => c.id === conversationId);
        return conversation?.others.find((m) => m.id === senderId)?.username ?? null;
    };

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel("kindred-chat")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages" },
                (payload) => {
                    const row = payload.new as MessageRow;

                    for (const listener of listenersRef.current) listener(row);

                    // The list has to move even when the conversation is not open, which is
                    // the whole reason this lives in the shell.
                    setConversations((current) =>
                        current.map((conversation) =>
                            conversation.id === row.conversation_id
                                ? {
                                      ...conversation,
                                      lastMessageAt: row.created_at,
                                      preview: row.body,
                                      unreadCount:
                                          row.sender_id === userId
                                              ? conversation.unreadCount
                                              : conversation.unreadCount + 1,
                                  }
                                : conversation,
                        ),
                    );

                    // Three things are deliberately not announced. Your own message, obviously.
                    // The bot's icebreakers, which the card in the timeline introduces far
                    // better than a toast could. And anything in the conversation currently on
                    // screen — being told about a message you are looking at is the fastest
                    // way to make someone start ignoring notifications altogether.
                    if (
                        row.sender_id &&
                        row.sender_id !== userId &&
                        row.conversation_id !== openConversationRef.current
                    ) {
                        showToast({
                            kind: "message",
                            // Named, not "New message". The payload has only a sender id, but
                            // the list already holds every member of every conversation this
                            // user is in — so the name is a lookup rather than a round trip.
                            title: nameOf(row.sender_id, row.conversation_id) ?? "New message",
                            body: row.body,
                            mergeKey: `message:${row.sender_id}`,
                        });
                    }
                },
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "messages" },
                (payload) => {
                    // An edit or a delete. Both rewrite a row the timeline is already holding,
                    // so they go to the same listeners as an arrival and are told apart there
                    // by whether the id is one already on screen.
                    const row = payload.new as MessageRow;
                    for (const listener of listenersRef.current) listener(row);
                },
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "conversations" },
                (payload) => {
                    const row = payload.new as { id: string; requested_of: string | null };

                    // Clearing requested_of is a wave being accepted, which moves the
                    // conversation from Pending to Active for both people.
                    setConversations((current) =>
                        current.map((conversation) =>
                            conversation.id === row.id
                                ? {
                                      ...conversation,
                                      pending: row.requested_of !== null,
                                      awaitingYou: row.requested_of === userId,
                                  }
                                : conversation,
                        ),
                    );
                },
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "conversation_members" },
                (payload) => {
                    const row = payload.new as {
                        conversation_id: string;
                        profile_id: string;
                        last_read_at: string;
                    };

                    // Two different things depending on whose read this is.
                    //
                    // Somebody else's turns one tick into two, without a table of per-message
                    // receipts. Your OWN clears your unread badge — and that is the only thing
                    // that does. The INSERT handler above increments for every message you did
                    // not send, including in the conversation you are sitting in reading it, so
                    // without this the badge climbed while you watched and only came down on a
                    // full navigation.
                    //
                    // Round-tripping your own read through the socket rather than zeroing it
                    // locally keeps one source of truth: the badge follows last_read_at, which
                    // is the same column the server counts against.
                    setConversations((current) =>
                        current.map((conversation) =>
                            conversation.id === row.conversation_id
                                ? row.profile_id === userId
                                    ? { ...conversation, unreadCount: 0 }
                                    : {
                                          ...conversation,
                                          readBy: {
                                              ...conversation.readBy,
                                              [row.profile_id]: row.last_read_at,
                                          },
                                      }
                                : conversation,
                        ),
                    );
                },
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "conversation_members" },
                (payload) => {
                    const row = payload.new as { conversation_id: string; profile_id: string };

                    // Only your own: everyone else's joins are somebody else's business.
                    if (row.profile_id !== userId) return;

                    // A wave is the case this exists for. The conversations INSERT that goes
                    // with it is refused by RLS — at that instant the recipient is not yet a
                    // member, so the policy is correct to hide it — and this row is the first
                    // thing they are allowed to see. Which means the list cannot patch itself
                    // from the payload; it has to go and ask.
                    //
                    // Without it a wave sat unseen until the next navigation, which is what
                    // made Pending look like it needed a refresh button.
                    void loadConversation(row.conversation_id).then((conversation) => {
                        if (!conversation) return;

                        setConversations((current) =>
                            current.some((existing) => existing.id === conversation.id)
                                ? current
                                : [conversation, ...current],
                        );

                        if (conversation.awaitingYou) {
                            showToast({
                                kind: "message",
                                title: `${conversation.title} wants to say hi`,
                                mergeKey: `wave:${conversation.id}`,
                            });
                        }
                    });
                },
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "message_reactions" },
                (payload) => {
                    const row = payload.new as ReactionRow;
                    for (const listener of reactionListenersRef.current) listener(row, true);
                },
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "message_reactions" },
                (payload) => {
                    // A retraction is an UPDATE setting deleted_at, not a DELETE — which is
                    // what makes it symmetric with the INSERT above. Realtime evaluates RLS
                    // against the row it forwards, and an UPDATE payload carries the full new
                    // row, so "members read reactions" runs on it and a removal reaches only
                    // people who can read the message. A DELETE payload carried just the
                    // replica identity, so the policy could not run and removals went to every
                    // subscriber. See 20260903000000.
                    //
                    // Reading deleted_at rather than assuming a direction also means clearing
                    // it — reacting again after taking it back — arrives correctly as an add.
                    const row = payload.new as ReactionRow;
                    for (const listener of reactionListenersRef.current) {
                        listener(row, isReactionPresent(row));
                    }
                },
            )
            .subscribe((status) => {
                setConnected(status === "SUBSCRIBED");
            });

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [userId, showToast]);

    // Re-seed when the server sends a newer list — a wave creates a conversation this
    // subscription never sees, because the INSERT lands on a row the user was not yet a
    // member of when Realtime applied its policy check.
    //
    // Adjusted during render rather than in an effect. Setting state from an effect renders
    // once with the stale list and again with the new one, and React flags it for exactly
    // that reason; this way the stale render never commits. Same shape OnboardingWizard.tsx
    // uses to fold a server action's result into local state.
    const [seenConversations, setSeenConversations] = useState(initialConversations);
    if (seenConversations !== initialConversations) {
        setSeenConversations(initialConversations);
        setConversations(initialConversations);
    }

    // Writes a ref rather than state: which conversation is open only ever affects whether a
    // toast fires, and putting it in state would re-render every consumer on navigation to
    // change something nothing renders.
    const setOpenConversation = useCallback((conversationId: string | null) => {
        openConversationRef.current = conversationId;
    }, []);

    const value = useMemo(
        () => ({ conversations, onMessage, onReaction, connected, setOpenConversation }),
        [conversations, onMessage, onReaction, connected, setOpenConversation],
    );

    return (
        <ChatRealtimeContext.Provider value={value}>{children}</ChatRealtimeContext.Provider>
    );
}
