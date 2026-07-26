"use client";

import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { sendChatMessage } from "@/app/(app)/chats/actions";
import type { ChatMessage } from "@/lib/chat/types";

/// How the moderation refusal is explained. The copy lives here so every surface that can
/// send says the same thing.
function noticeFor(cooldownUntil: number | null, secondsLeft: number): string {
    if (cooldownUntil && secondsLeft > 0) {
        return `Please keep this chat respectful — offensive language isn't allowed here, and repeated violations may result in restrictions on your account. You can send messages again in ${secondsLeft}s.`;
    }
    return "That message wasn't sent — please keep this chat respectful. Continuing to send offensive messages will temporarily restrict you from chatting.";
}

export default function Composer({
    conversationId,
    greeting,
    onSent,
}: {
    conversationId: string;
    /// Prefilled when arriving from a wave, so the 👋 is already there to send.
    greeting?: string;
    /// The server's copy of the message, so the timeline can show it without waiting for the
    /// realtime round trip.
    onSent: (message: ChatMessage) => void;
}) {
    const [draft, setDraft] = useState(greeting ?? "");
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Ticks the countdown while a cooldown is active, and clears itself once it expires.
    useEffect(() => {
        if (!cooldownUntil) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining === 0) {
                setCooldownUntil(null);
                setNotice(null);
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [cooldownUntil]);

    // A warning-only refusal has no cooldown to count down, so it clears on a timer.
    useEffect(() => {
        if (!notice || cooldownUntil) return;
        const timeout = setTimeout(() => setNotice(null), 6000);
        return () => clearTimeout(timeout);
    }, [notice, cooldownUntil]);

    const send = async () => {
        const body = draft.trim();
        if (!body || sending) return;

        setSending(true);
        try {
            const result = await sendChatMessage({ conversationId, body });

            if (result.ok) {
                setDraft("");
                setNotice(null);
                onSent(result.message);
                return;
            }

            if (result.reason === "moderated") {
                // The draft is deliberately kept: the message was refused, not lost, and
                // making someone retype it to rephrase it would be its own punishment.
                setCooldownUntil(result.cooldownUntil);
                setNotice(noticeFor(result.cooldownUntil, secondsLeft));
            }
        } finally {
            setSending(false);
        }
    };

    const blocked = !!cooldownUntil && secondsLeft > 0;

    return (
        <div className="border-t border-ink-900/8">
            {notice && (
                <p role="alert" className="border-b border-red-700/20 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {notice}
                </p>
            )}

            <div className="flex items-end gap-2 p-3">
                <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        // Enter sends, Shift+Enter breaks the line — what every chat does.
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void send();
                        }
                    }}
                    rows={1}
                    maxLength={4000}
                    disabled={blocked}
                    placeholder={blocked ? "You can send again shortly…" : "Message"}
                    aria-label="Message"
                    className="max-h-32 min-h-9 w-full flex-1 resize-none rounded-2xl border border-bone-300 bg-bone-100 px-3 py-2 text-meta text-ink-900 outline-none transition-colors placeholder:text-ink-600 focus:border-accent-600 focus-visible:ring-2 focus-visible:ring-accent-600/40 disabled:opacity-60"
                />

                <button
                    type="button"
                    aria-label="Send"
                    disabled={!draft.trim() || sending || blocked}
                    onClick={send}
                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-600 text-surface transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-bone-300 disabled:text-ink-600"
                >
                    <SendHorizontal size={16} strokeWidth={1.5} aria-hidden />
                </button>
            </div>
        </div>
    );
}
