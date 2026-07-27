"use client";

import { Check, CheckCheck, Clock, Lightbulb } from "lucide-react";

import ReactionBar from "@/components/chat/ReactionBar";
import Avatar from "@/components/ui/Avatar";
import type { ReactionEmoji } from "@/lib/chat/reactions";
import type { PendingAttachment, TimelineMessage } from "@/lib/chat/types";

const KINDRED_BOT_NAME = "Kindred";

/// How far along your own message is. Only ever drawn on your own — a tick on someone
/// else's message would be telling them something they already know.
///
/// Three states, not four. There is no "delivered": a browser has nothing to acknowledge
/// delivery with, so a third tick would either duplicate "sent" or quietly mean "their tab
/// is open", which is presence and belongs in the header where it can say so honestly.
///
/// Drawn on the page background rather than on the bubble, so these are ink colours. It used
/// to sit inside the bubble and was styled in `surface` to read against the accent fill —
/// which would now be a near-invisible pale tick on a pale background.
function DeliveryState({ read, status }: { read: boolean; status?: string }) {
    if (status === "sending") {
        return <Clock size={12} strokeWidth={2} aria-label="Sending" className="text-ink-600" />;
    }

    // Read is the one state worth colouring: it is the only one that says something happened
    // at the other end rather than at ours.
    if (read) {
        return (
            <CheckCheck size={13} strokeWidth={2} aria-label="Read" className="text-accent-600" />
        );
    }

    return <Check size={13} strokeWidth={2} aria-label="Sent" className="text-ink-600" />;
}

/// One message in the timeline.
///
/// An icebreaker gets its own card rather than a bubble, because it is a question addressed
/// to the room rather than something someone said. The richer version of that card — hidden
/// answers, an answered count, an inline reply box — lands with the rest of the parity pass;
/// this is the shape it grows into.
export default function MessageBubble({
    message,
    isOwn,
    showSender,
    read = false,
    userId,
    onToggleReaction,
    onAttach,
}: {
    message: TimelineMessage;
    isOwn: boolean;
    /// False when the previous message was from the same person, so a run of messages reads
    /// as one turn rather than repeating a name and a face on every line.
    showSender: boolean;
    /// Everyone else in the conversation has seen this one.
    read?: boolean;
    /// Whose view this is — decides which reaction pills read as yours.
    userId: string;
    onToggleReaction: (messageId: string, emoji: ReactionEmoji) => void;
    /// Aims the composer at this message — as an answer, or as a quote.
    onAttach: (attachment: PendingAttachment) => void;
}) {
    if (message.kind === "icebreaker_prompt") {
        return (
            <li className="my-3 flex justify-center">
                <div className="w-full max-w-md rounded-card border border-bone-300 bg-surface p-4 shadow-card">
                    <p className="flex items-center gap-1.5 text-label uppercase text-ink-600">
                        <Lightbulb size={13} strokeWidth={1.5} aria-hidden />
                        Icebreaker
                    </p>
                    <p className="mt-1.5 text-body font-medium text-ink-900">{message.body}</p>

                    {/* Two actions, and the difference between them is the point. Answering
                        sends a promptId, which is what earns the larger award; quoting only
                        pulls the question above your message so you can talk about it. Both
                        used to be here and people used them for different things. */}
                    <div className="mt-3 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                onAttach({
                                    mode: "answer",
                                    messageId: message.id,
                                    preview: message.body,
                                })
                            }
                            className="rounded-full bg-accent-600 px-3 py-1 text-label font-medium text-surface transition-colors hover:bg-accent-700"
                        >
                            Answer this
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                onAttach({
                                    mode: "quote",
                                    messageId: message.id,
                                    preview: message.body,
                                    author: null,
                                })
                            }
                            className="rounded-full border border-bone-300 px-3 py-1 text-label text-ink-600 transition-colors hover:border-ink-900/20 hover:text-ink-900"
                        >
                            Quote
                        </button>
                    </div>
                </div>
            </li>
        );
    }

    if (message.deletedAt) {
        return (
            <li className={`flex px-4 py-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                <p className="text-meta italic text-ink-600">Message deleted</p>
            </li>
        );
    }

    const senderName = message.sender?.username ?? KINDRED_BOT_NAME;

    return (
        <li
            className={`group flex gap-2 px-4 py-0.5 ${isOwn ? "justify-end" : "justify-start"}`}
        >
            {/* A spacer keeps a run of messages aligned once the avatar stops repeating. */}
            {!isOwn &&
                (showSender ? (
                    <Avatar
                        name={senderName}
                        avatarId={message.sender?.avatarId ?? undefined}
                        avatarSeed={message.sender?.avatarSeed ?? undefined}
                        size={28}
                    />
                ) : (
                    <span className="w-7 shrink-0" aria-hidden />
                ))}

            <div className={`flex max-w-[min(32rem,75%)] flex-col ${isOwn ? "items-end" : ""}`}>
                {!isOwn && showSender && (
                    <span className="mb-0.5 text-label text-ink-600">{senderName}</span>
                )}

                {/* What this message is quoting, above it and clipped to one line. Sits
                    outside the bubble so it reads as a reference to something else rather
                    than as part of what was said. A quoted message that has since been
                    deleted arrives as null from the mapper, so there is nothing to guard. */}
                {message.replyTo && (
                    <div
                        className={`mb-0.5 max-w-full border-l-2 border-accent-600/40 py-0.5 pl-2 ${
                            isOwn ? "text-right" : ""
                        }`}
                    >
                        {message.replyTo.senderName && (
                            <span className="text-label text-ink-600">
                                {message.replyTo.senderName}
                            </span>
                        )}
                        <p className="truncate text-label text-ink-600">
                            {message.replyTo.body}
                        </p>
                    </div>
                )}

                <div
                    className={`rounded-2xl px-3 py-2 text-meta wrap-break-word ${
                        isOwn
                            ? "bg-accent-600 text-surface"
                            : "border border-bone-300 bg-surface text-ink-900"
                    } ${message.status === "sending" ? "opacity-70" : ""}`}
                >
                    {message.body}
                    {message.editedAt && (
                        <span className={`ml-1.5 text-label ${isOwn ? "text-surface/70" : "text-ink-600"}`}>
                            edited
                        </span>
                    )}
                </div>

                {/* One meta row under the bubble carrying both the reactions and, on your own
                    messages, the tick. The tick used to sit inside the bubble trailing the
                    text, which wrapped onto a line of its own whenever the text filled the
                    width — leaving it stranded under the message rather than beside it. Below
                    the bubble it lands in the same place every time. */}
                <div className={`mt-1 flex items-center gap-1.5 ${isOwn ? "justify-end" : ""}`}>
                    {/* Not while the message is still optimistic: its id is a placeholder the
                        server has never seen, so a reaction sent against it would be refused. */}
                    {message.status !== "sending" && (
                        <ReactionBar
                            reactions={message.reactions}
                            userId={userId}
                            align={isOwn ? "end" : "start"}
                            onToggle={(emoji) => onToggleReaction(message.id, emoji)}
                        />
                    )}

                    {/* Last, so it sits outermost on the right where a status marker reads. */}
                    {isOwn && <DeliveryState read={read} status={message.status} />}
                </div>
            </div>
        </li>
    );
}
