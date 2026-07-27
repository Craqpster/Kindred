"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { markConversationRead, toggleMessageReaction } from "@/app/(app)/chats/actions";
import Composer from "@/components/chat/Composer";
import MessageBubble from "@/components/chat/MessageBubble";
import { useChatRealtime } from "@/components/chat/ChatRealtimeProvider";
import type { ReactionEmoji } from "@/lib/chat/reactions";
import { applyReaction, mergeMessage, messageFromRow } from "@/lib/chat/realtime";
import type { ChatConversation, ChatMessage, TimelineMessage } from "@/lib/chat/types";

const GREETING = "👋";

/// One open conversation: its history, whatever arrives while it is open, and the composer.
///
/// Keyed by conversation id where it is rendered, so switching chats remounts it rather than
/// trying to reconcile one thread's state into another's.
export default function Thread({
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
    const { onMessage, onReaction } = useChatRealtime();
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

    // Reactions arrive for every conversation, not just this one. applyReaction ignores a
    // message id the timeline is not holding, so there is nothing to filter on the way in.
    useEffect(() => {
        return onReaction((row, present) => {
            setMessages((current) => applyReaction(current, row, present));
        });
    }, [onReaction]);

    /// Draws the change immediately, then lets the server settle it.
    ///
    /// The optimistic guess is a plain inversion of what is on screen. It can be wrong — the
    /// same reaction from another tab, or a message deleted underneath — so the result is
    /// applied unconditionally rather than only on failure: `reacted` is the state afterwards,
    /// so re-applying it corrects a wrong guess and is a no-op when the guess was right.
    const toggle = async (messageId: string, emoji: ReactionEmoji) => {
        const message = messages.find((m) => m.id === messageId);
        const mine = !!message?.reactions
            .find((reaction) => reaction.emoji === emoji)
            ?.reactedBy.includes(userId);

        const row = { message_id: messageId, profile_id: userId, emoji };
        setMessages((current) => applyReaction(current, row, !mine));

        const result = await toggleMessageReaction({ messageId, emoji });

        setMessages((current) =>
            applyReaction(current, row, result.ok ? result.reacted : mine),
        );
    };

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
                <h1 className="truncate text-body font-medium text-ink-900">
                    {conversation.title}
                </h1>
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
                            userId={userId}
                            onToggleReaction={toggle}
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
