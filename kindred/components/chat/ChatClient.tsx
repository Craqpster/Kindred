"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { markConversationRead } from "@/app/(app)/chats/actions";
import ChatTabs, { type ChatTab } from "@/components/chat/ChatTabs";
import Composer from "@/components/chat/Composer";
import ConversationRow from "@/components/chat/ConversationRow";
import MessageBubble from "@/components/chat/MessageBubble";
import { useChatRealtime } from "@/components/chat/ChatRealtimeProvider";
import { mergeMessage, messageFromRow } from "@/lib/chat/realtime";
import type { ChatConversation, ChatMessage, TimelineMessage } from "@/lib/chat/types";

const GREETING = "👋";

export default function ChatClient({
    userId,
    openConversationId,
    initialMessages,
    greet = false,
    initialTab = "active",
}: {
    userId: string;
    openConversationId?: string;
    initialMessages: ChatMessage[];
    greet?: boolean;
    initialTab?: ChatTab;
}) {
    const router = useRouter();
    const { conversations } = useChatRealtime();
    const [tab, setTab] = useState<ChatTab>(initialTab);

    const { active, pending } = useMemo(() => {
        const active: ChatConversation[] = [];
        const pending: ChatConversation[] = [];
        for (const conversation of conversations) {
            (conversation.pending ? pending : active).push(conversation);
        }
        return { active, pending };
    }, [conversations]);

    const shown = tab === "active" ? active : pending;
    const open = conversations.find((conversation) => conversation.id === openConversationId);

    return (
        <div className="flex flex-1 min-h-0 bg-bone-100">
            <div className="flex w-80 shrink-0 flex-col min-h-0 border-r border-ink-900/8">
                <ChatTabs tab={tab} onChange={setTab} pendingCount={pending.length} />

                <div className="flex-1 overflow-y-auto px-2 pb-3">
                    {shown.length === 0 ? (
                        <p className="p-3 text-sm text-ink-600">
                            {tab === "active"
                                ? "No chats yet. Say hi to someone on Meet."
                                : "Nothing waiting on a reply."}
                        </p>
                    ) : (
                        shown.map((conversation) => (
                            <ConversationRow
                                key={conversation.id}
                                conversation={conversation}
                                selected={conversation.id === openConversationId}
                                onOpen={(id) => router.push(`/chats?c=${encodeURIComponent(id)}`)}
                            />
                        ))
                    )}
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
                {open ? (
                    <Thread
                        key={open.id}
                        userId={userId}
                        conversation={open}
                        initialMessages={initialMessages}
                        greet={greet}
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center p-8 text-meta text-ink-600">
                        Pick a conversation to get started.
                    </div>
                )}
            </div>
        </div>
    );
}

/// One open conversation. Keyed by conversation id in the parent, so switching chats
/// remounts it rather than trying to reconcile one thread's state into another's.
function Thread({
    userId,
    conversation,
    initialMessages,
    greet,
}: {
    userId: string;
    conversation: ChatConversation;
    initialMessages: ChatMessage[];
    greet: boolean;
}) {
    const { onMessage } = useChatRealtime();
    const [messages, setMessages] = useState<TimelineMessage[]>(initialMessages);
    const bottomRef = useRef<HTMLDivElement>(null);

    /// The oldest moment everyone else has read up to.
    ///
    /// The MINIMUM across the other members, so a group only shows two ticks once the whole
    /// room has seen it. For a DM there is one other person and this is simply their
    /// timestamp. Null when somebody has never opened the conversation at all.
    const readThrough = useMemo(() => {
        const timestamps = conversation.others.map((member) => conversation.readBy[member.id]);
        if (timestamps.length === 0 || timestamps.some((at) => !at)) return null;
        return timestamps.reduce((oldest, at) => (at < oldest ? at : oldest));
    }, [conversation.others, conversation.readBy]);

    // Everyone who could have written in here, so an arriving row can be given a name and a
    // face without a round trip. See messageFromRow.
    const membersById = useMemo(
        () => new Map(conversation.others.map((member) => [member.id, member])),
        [conversation.others],
    );

    useEffect(() => {
        return onMessage((row) => {
            if (row.conversation_id !== conversation.id) return;
            // Thread replies do not belong in the main timeline.
            if (row.parent_id) return;

            setMessages((current) => mergeMessage(current, messageFromRow(row, membersById)));
        });
    }, [onMessage, conversation.id, membersById]);

    // Opening a conversation reads it, and so does a message arriving while it is open.
    useEffect(() => {
        void markConversationRead(conversation.id);
    }, [conversation.id, messages.length]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length]);

    return (
        <>
            <header className="flex items-center gap-3 border-b border-ink-900/8 px-4 py-3">
                <h1 className="truncate text-body font-medium text-ink-900">{conversation.title}</h1>
            </header>

            <ul className="flex-1 overflow-y-auto py-3">
                {messages.length === 0 ? (
                    <li className="p-4 text-center text-meta text-ink-600">
                        Nothing here yet — say something.
                    </li>
                ) : (
                    messages.map((message, index) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            isOwn={message.sender?.id === userId}
                            showSender={messages[index - 1]?.sender?.id !== message.sender?.id}
                            read={!!readThrough && readThrough >= message.createdAt}
                        />
                    ))
                )}
                <div ref={bottomRef} />
            </ul>

            <Composer
                conversationId={conversation.id}
                userId={userId}
                greeting={greet ? GREETING : undefined}
                onOptimistic={(message) =>
                    setMessages((current) => mergeMessage(current, message))
                }
                onSettled={(temporaryId, message) =>
                    setMessages((current) => {
                        // The optimistic copy goes either way: replaced by the server's
                        // version, or dropped when the send was refused.
                        const without = current.filter((m) => m.id !== temporaryId);
                        return message ? mergeMessage(without, message) : without;
                    })
                }
            />
        </>
    );
}
