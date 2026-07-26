"use client";

import { Check, CheckCheck, Clock, Lightbulb } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import type { TimelineMessage } from "@/lib/chat/types";

const KINDRED_BOT_NAME = "Kindred";

/// How far along your own message is. Only ever drawn on your own — a tick on someone
/// else's message would be telling them something they already know.
///
/// Three states, not four. There is no "delivered": a browser has nothing to acknowledge
/// delivery with, so a third tick would either duplicate "sent" or quietly mean "their tab
/// is open", which is presence and belongs in the header where it can say so honestly.
function DeliveryState({ read, status }: { read: boolean; status?: string }) {
    if (status === "sending") {
        return <Clock size={12} strokeWidth={2} aria-label="Sending" className="text-surface/60" />;
    }

    if (read) {
        return <CheckCheck size={13} strokeWidth={2} aria-label="Read" className="text-surface" />;
    }

    return <Check size={13} strokeWidth={2} aria-label="Sent" className="text-surface/60" />;
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
}: {
    message: TimelineMessage;
    isOwn: boolean;
    /// False when the previous message was from the same person, so a run of messages reads
    /// as one turn rather than repeating a name and a face on every line.
    showSender: boolean;
    /// Everyone else in the conversation has seen this one.
    read?: boolean;
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
        <li className={`flex gap-2 px-4 py-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
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

                    {/* Inside the bubble, trailing the text: a tick in the gutter drifts away
                        from the message it belongs to on a short line. */}
                    {isOwn && (
                        <span className="ml-1.5 inline-flex translate-y-0.5 align-baseline">
                            <DeliveryState read={read} status={message.status} />
                        </span>
                    )}
                </div>
            </div>
        </li>
    );
}
