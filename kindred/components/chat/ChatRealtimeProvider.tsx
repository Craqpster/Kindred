"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useToast } from "@/components/ui/ToastStack";
import type { ChatConversation } from "@/lib/chat/types";
import type { MessageRow } from "@/lib/chat/realtime";
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
    /// True once the socket has actually joined. Until then a message could be missed, which
    /// the UI can use to decide whether it still needs to poll on focus.
    connected: boolean;
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

    const onMessage = useMemo(
        () => (listener: (row: MessageRow) => void) => {
            listenersRef.current.add(listener);
            return () => {
                listenersRef.current.delete(listener);
            };
        },
        [],
    );

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

                    // The bot's icebreakers announce themselves in the timeline far better
                    // than a toast can, and toasting your own message back at you is noise.
                    if (row.sender_id && row.sender_id !== userId) {
                        showToast({
                            kind: "message",
                            title: "New message",
                            body: row.body,
                            mergeKey: `message:${row.sender_id}`,
                        });
                    }
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
            .subscribe((status) => {
                setConnected(status === "SUBSCRIBED");
            });

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [userId, showToast]);

    // Re-seed when the server sends a newer list — a wave creates a conversation this
    // subscription never sees, since the INSERT lands on a row the user was not yet a member
    // of when the socket applied its policy check.
    useEffect(() => {
        setConversations(initialConversations);
    }, [initialConversations]);

    const value = useMemo(
        () => ({ conversations, onMessage, connected }),
        [conversations, onMessage, connected],
    );

    return (
        <ChatRealtimeContext.Provider value={value}>{children}</ChatRealtimeContext.Provider>
    );
}
