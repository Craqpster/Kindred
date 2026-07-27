"use client";

import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { sendChatMessage } from "@/app/(app)/chats/actions";
import type { AwardResult } from "@/lib/confidence";
import type { TimelineMessage } from "@/lib/chat/types";

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
    userId,
    greeting,
    onOptimistic,
    onSettled,
    onAward,
}: {
    conversationId: string;
    userId: string;
    /// Prefilled when arriving from a wave, so the 👋 is already there to send.
    greeting?: string;
    /// Shown immediately, before the server has been asked. Carries a temporary id.
    onOptimistic: (message: TimelineMessage) => void;
    /// The server's copy replaces the optimistic one — or null when the send was refused,
    /// which removes it again.
    onSettled: (temporaryId: string, message: TimelineMessage | null) => void;
    /// What the message earned, when it earned anything. Carries the conversation's new
    /// total, so the sender's badge moves without asking the server a second time.
    onAward: (award: AwardResult) => void;
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

        // Shown before the server is even asked, so the bubble appears the instant Enter is
        // pressed rather than after a round trip. The id is temporary and gets swapped for
        // the real one below — it exists so the optimistic copy can be found again.
        const temporaryId = crypto.randomUUID();
        onOptimistic({
            id: temporaryId,
            conversationId,
            kind: "text",
            body,
            // Enough of a sender to be recognised as yours. Own messages render without a
            // name or avatar, so nothing else here would be drawn.
            sender: { id: userId, username: "", avatarId: null, avatarSeed: null },
            replyTo: null,
            promptId: null,
            parentId: null,
            replyCount: 0,
            gameType: null,
            reactions: [],
            createdAt: new Date().toISOString(),
            editedAt: null,
            deletedAt: null,
            pinnedAt: null,
            status: "sending",
        });

        // Cleared now rather than on success: the message is visibly in the timeline, so
        // leaving it in the box too would read as though it had not sent.
        setDraft("");
        setSending(true);

        try {
            const result = await sendChatMessage({ conversationId, body });

            if (result.ok) {
                setNotice(null);
                onSettled(temporaryId, { ...result.message, status: "sent" });
                // Null whenever the message did not qualify — too short, or not a genuine
                // turn. Most messages earn nothing, so this is the common path.
                if (result.award) onAward(result.award);
                return;
            }

            // Refused, so the optimistic bubble has to go — leaving it would show a message
            // that does not exist and that nobody will ever receive.
            onSettled(temporaryId, null);

            if (result.reason === "moderated") {
                // The text comes back to the box: it was refused, not lost, and making
                // someone retype it in order to rephrase it would be its own punishment.
                setDraft(body);
                setCooldownUntil(result.cooldownUntil);
                setNotice(noticeFor(result.cooldownUntil, secondsLeft));
            }
        } catch {
            // The action never reached the server, or never came back. Same treatment.
            onSettled(temporaryId, null);
            setDraft(body);
            setNotice("That message didn't send. Check your connection and try again.");
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
