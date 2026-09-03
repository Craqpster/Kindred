"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
    deleteChatMessage,
    editChatMessage,
    loadMessagesSince,
    markConversationRead,
    toggleMessageReaction,
} from "@/app/(app)/chats/actions";
import AvatarGroup from "@/components/chat/AvatarGroup";
import ChatLevelBadge from "@/components/chat/ChatLevelBadge";
import Composer from "@/components/chat/Composer";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageEditor from "@/components/chat/MessageEditor";
import PresenceLine, {
    GroupPresenceLine,
    ReconnectingLine,
} from "@/components/chat/PresenceLine";
import TypingLine from "@/components/chat/TypingLine";
import { useChatRealtime } from "@/components/chat/ChatRealtimeProvider";
import {
    ConversationChannelProvider,
    useConversationChannel,
} from "@/components/chat/useConversationChannel";
import { useConversationXp } from "@/components/chat/useConversationXp";
import Avatar from "@/components/ui/Avatar";
import { dayLabel, endsRun, startsNewDay, startsNewRun } from "@/lib/chat/grouping";
import type { ReactionEmoji } from "@/lib/chat/reactions";
import { applyReaction, applyRow, backfillCursor, mergeMessage } from "@/lib/chat/realtime";
import type {
    ChatConversation,
    ChatMessage,
    ConversationXp,
    PendingAttachment,
    TimelineMessage,
} from "@/lib/chat/types";

const GREETING = "👋";

/// One open conversation: its history, whatever arrives while it is open, and the composer.
///
/// Keyed by conversation id where it is rendered, so switching chats remounts it rather than
/// trying to reconcile one thread's state into another's.
export default function Thread({
    userId,
    conversation,
    initialMessages,
    initialXp,
    greet,
}: {
    userId: string;
    conversation: ChatConversation;
    initialMessages: ChatMessage[];
    /// Rendered by the server so the badge is right at first paint. Null only if the
    /// conversation was not readable, which the page has already handled by then.
    initialXp: ConversationXp | null;
    greet: boolean;
}) {
    const { onMessage, onReaction, onResync, status, setOpenConversation } = useChatRealtime();
    const channel = useConversationChannel(conversation.id, userId);
    const { statusOf, typingIds, reportTyping } = channel;
    const { xp, applyAward } = useConversationXp({
        conversationId: conversation.id,
        userId,
        initialXp,
    });
    const [messages, setMessages] = useState<TimelineMessage[]>(initialMessages);
    /// What the composer will attach to the next message — set by the icebreaker card's two
    /// buttons, cleared once the message is away or the user backs out.
    const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
    /// Which message is being rewritten, and why the last attempt was refused. Held here
    /// rather than in the bubble so the draft survives the timeline re-rendering underneath
    /// it — a message arriving mid-edit should not throw away what you were typing.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editError, setEditError] = useState<string | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
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
            // Thread replies belong behind their parent, not in the main timeline. XP is not
            // affected either way — useConversationXp keeps its own subscription, so a reply
            // still earns without this having to sequence the two.
            if (row.parent_id) return;

            setMessages((current) =>
                applyRow(current, row, membersById, (message) => ({ ...message, status: "sent" })),
            );
        });
    }, [onMessage, conversation.id, membersById]);

    /// The timeline as the resync listener needs to read it.
    ///
    /// Same reason the provider keeps one for its conversation list: the listener is
    /// registered once per conversation, so it closes over whatever `messages` was at that
    /// moment. Re-registering on every message instead would mean tearing down and rebuilding
    /// the subscription each time one arrives.
    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Close the gap a dropped socket leaves behind.
    //
    // Realtime does not replay what it missed, so every message that landed while the socket
    // was away is invisible to this timeline and nothing later will mention it. The rejoin is
    // the only cue there is.
    useEffect(() => {
        return onResync(() => {
            void loadMessagesSince(conversation.id, backfillCursor(messagesRef.current))
                .then(({ messages: missed, complete }) => {
                    if (complete && missed.length === 0) return;

                    setMessages((current) =>
                        complete
                            ? missed.reduce(
                                  (timeline, message) => mergeMessage(timeline, message),
                                  current,
                              )
                            : // Too much missed to stitch, so these are the newest page
                              // rather than the oldest missed. Merging them would leave the
                              // hole they skipped sitting underneath, below messages the
                              // reader can see — worse than the staleness being fixed. The
                              // timeline starts again from what it was handed.
                              //
                              // Anything still in flight is dropped with it. That is correct:
                              // an optimistic message survives on its own send response, and
                              // one whose send never landed should not outlive a reload.
                              missed,
                    );
                })
                // A rejoin can arrive while the network is still unhappy. The socket will drop
                // and rejoin again by itself, and this listener runs again when it does.
                .catch(() => {});
        });
    }, [onResync, conversation.id]);

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

    const saveEdit = async (messageId: string, body: string) => {
        setSavingEdit(true);
        try {
            const result = await editChatMessage({ messageId, body });

            if (result.ok) {
                // Applied straight away rather than waiting for the realtime echo, so the
                // person who made the edit sees it land immediately.
                setMessages((current) => mergeMessage(current, { ...result.message, status: "sent" }));
                setEditingId(null);
                setEditError(null);
                return;
            }

            setEditError(
                result.reason === "moderated"
                    ? "That edit wasn't saved — please keep this chat respectful."
                    : "That edit couldn't be saved.",
            );
        } finally {
            setSavingEdit(false);
        }
    };

    const removeMessage = async (messageId: string) => {
        // Drawn immediately: a delete you have to wait for is one you press twice.
        setMessages((current) =>
            current.map((message) =>
                message.id === messageId
                    ? { ...message, body: "", deletedAt: new Date().toISOString() }
                    : message,
            ),
        );

        await deleteChatMessage(messageId);
    };

    // Opening a conversation reads it, and so does a message arriving while it is open.
    useEffect(() => {
        void markConversationRead(conversation.id);
    }, [conversation.id, messages.length]);

    // Tells the shell not to toast messages from this conversation while it is on screen.
    // Cleared on unmount so closing the chat starts them announcing again.
    useEffect(() => {
        setOpenConversation(conversation.id);
        return () => setOpenConversation(null);
    }, [setOpenConversation, conversation.id]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length]);

    return (
        // Provided rather than drilled: a game board sits inside a message inside the
        // timeline, three levels below this, and MessageBubble should not have to carry
        // reportMove through just because one kind of message needs it.
        <ConversationChannelProvider value={channel}>
            {/* Whoever you are talking to, at the top and centred: a face and a name rather
                than a line of text in a corner. A DM is one person, so the header can afford
                to be about them — which is the difference between a chat and a ticket. */}
            <header className="relative border-b border-ink-900/8 px-4 py-5">
                <div className="flex flex-col items-center gap-2">
                    {conversation.kind === "group" ? (
                        <AvatarGroup
                            users={conversation.others.map((member) => ({
                                name: member.username,
                            }))}
                            size={56}
                        />
                    ) : (
                        <Avatar
                            name={conversation.title}
                            avatarId={conversation.others[0]?.avatarId ?? undefined}
                            avatarSeed={conversation.others[0]?.avatarSeed ?? undefined}
                            size={56}
                        />
                    )}

                    {/* A DM's title IS a person, so it links to them. A group's is a name
                        somebody typed, which links nowhere. */}
                    {conversation.kind === "dm" && conversation.others[0] ? (
                        <Link
                            href={`/u/${conversation.others[0].id}`}
                            className="max-w-full truncate text-title text-ink-900 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                            {conversation.title}
                        </Link>
                    ) : (
                        <h1 className="max-w-full truncate text-title text-ink-900">
                            {conversation.title}
                        </h1>
                    )}

                    {/* A DM has one other person, so their status can be stated plainly. A
                        group has several in several states, so it is summarised instead.
                        Neither is answerable while the socket is away — presence comes over
                        that same connection — so the line says so rather than leaving the
                        last known state on screen as though it were current. */}
                    {status === "reconnecting" ? (
                        <ReconnectingLine />
                    ) : conversation.kind === "group" ? (
                        <GroupPresenceLine
                            activeCount={
                                conversation.others.filter(
                                    (member) => statusOf(member.id) === "active",
                                ).length
                            }
                        />
                    ) : (
                        <PresenceLine
                            status={
                                conversation.others[0]
                                    ? statusOf(conversation.others[0].id)
                                    : "away"
                            }
                        />
                    )}

                    {/* Last in the stack, and part of it rather than pinned to a corner: who
                        you are talking to, then how warm the conversation has got. */}
                    {xp && (
                        <div className="mt-1">
                            <ChatLevelBadge xp={xp} />
                        </div>
                    )}
                </div>
            </header>

            <ul className="flex-1 overflow-y-auto py-3">
                {messages.length === 0 ? (
                    <li className="p-4 text-center text-meta text-ink-600">
                        Nothing here yet — say something.
                    </li>
                ) : (
                    messages.map((message, index) => {
                        const previous = messages[index - 1];
                        const next = messages[index + 1];

                        return (
                            <Fragment key={message.id}>
                                {startsNewDay(message, previous) && (
                                    <DaySeparator iso={message.createdAt} />
                                )}

                                <MessageBubble
                                    message={message}
                                    isOwn={message.sender?.id === userId}
                                    showSender={startsNewRun(message, previous)}
                                    isRunEnd={endsRun(message, next)}
                                    read={!!readThrough && readThrough >= message.createdAt}
                                    userId={userId}
                                    onToggleReaction={toggle}
                                    onAttach={setAttachment}
                                    // Your own words only, and only ordinary ones — an
                                    // icebreaker belongs to the bot and a game invite's text
                                    // is generated. Matches what editMessage will accept, so
                                    // no button is offered that the server would refuse.
                                    {...(message.sender?.id === userId &&
                                    message.kind === "text" &&
                                    !message.deletedAt
                                        ? {
                                              onEdit: () => {
                                                  setEditingId(message.id);
                                                  setEditError(null);
                                              },
                                              onDelete: () => void removeMessage(message.id),
                                          }
                                        : {})}
                                    editing={editingId === message.id}
                                    editor={
                                        <MessageEditor
                                            initialBody={message.body}
                                            saving={savingEdit}
                                            error={editError}
                                            onSave={(body) => void saveEdit(message.id, body)}
                                            onCancel={() => {
                                                setEditingId(null);
                                                setEditError(null);
                                            }}
                                        />
                                    }
                                />
                            </Fragment>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </ul>

            <TypingLine typingIds={typingIds} membersById={membersById} />

            <Composer
                conversationId={conversation.id}
                userId={userId}
                onTyping={reportTyping}
                greeting={greet ? GREETING : undefined}
                onOptimistic={(message) =>
                    setMessages((current) => mergeMessage(current, message))
                }
                onAward={applyAward}
                attachment={attachment}
                onClearAttachment={() => setAttachment(null)}
                onSettled={(temporaryId, message) =>
                    setMessages((current) => {
                        // The optimistic copy goes either way: replaced by the server's
                        // version, or dropped when the send was refused.
                        const without = current.filter((m) => m.id !== temporaryId);
                        return message ? mergeMessage(without, message) : without;
                    })
                }
            />
        </ConversationChannelProvider>
    );
}

/// The line a day starts on.
///
/// A pill on a rule rather than bare centred text: the rule is what actually divides the
/// scroll, and without it the label reads as another message from nobody.
function DaySeparator({ iso }: { iso: string }) {
    return (
        <li className="my-4 flex items-center gap-3 px-4" aria-hidden={false}>
            <span className="h-px flex-1 bg-bone-300" />
            <time
                dateTime={iso}
                className="rounded-full bg-bone-200 px-2.5 py-1 text-label uppercase text-ink-600"
            >
                {dayLabel(iso)}
            </time>
            <span className="h-px flex-1 bg-bone-300" />
        </li>
    );
}
