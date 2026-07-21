"use client";

import { Lightbulb } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import type { LocalMessage } from "stream-chat";
import { useChannelStateContext, useChatContext } from "stream-chat-react";

import Avatar from "@/components/ui/Avatar";
import AvatarGroup from "@/components/chat/AvatarGroup";
import { useModeratedSend } from "@/components/chat/useModeratedSend";

/// An icebreaker prompt and everything that belongs to it: the question, whoever has
/// answered it, and — until you have — the box you answer it in.
///
/// The card owns the whole interaction rather than handing off to the composer at the
/// bottom of the window. Prefilling that composer with the question (what this replaced)
/// meant the user had to delete the question before they could answer it, and sending
/// without noticing echoed the question back into the chat as though they had said it.
/// Keeping the input here also keeps the question on screen while it is being answered,
/// which is the whole point of having asked it.
///
/// Answers are matched to their prompt by promptId and rendered here, so ChatMessage
/// suppresses their normal bubbles (see the prompt_response branch there).
export default function IcebreakerCard({ message }: { message: LocalMessage }) {
    const { channel, messages } = useChannelStateContext();
    const { client } = useChatContext();
    const { moderate, finalizeSend, notice } = useModeratedSend();

    const [answering, setAnswering] = useState(false);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);

    const reduceMotion = useReducedMotion();
    const regionId = useId();
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // A tween, not a spring. A spring loose enough to feel alive overshoots, and
    // overshooting a height means the box opens taller than it will end up and then
    // shrinks back — which reads as a glitch, because the final height is a fact about
    // the content rather than something with momentum. The curve is --ease-smooth from
    // globals.css, spelled out because Motion needs the numbers, not the CSS token.
    const transition = reduceMotion
        ? { duration: 0 }
        : ({ duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const);

    // Opening the box should put the caret in it — the click that opened it was already
    // the decision to answer, so making the user click again is a wasted step.
    useEffect(() => {
        if (answering) inputRef.current?.focus();
    }, [answering]);

    const answers = (messages ?? []).filter(
        (m) => m.messageType === "prompt_response" && m.promptId === message.id,
    );
    const youAnswered = answers.some((a) => a.user?.id === client.userID);
    const answeredNames = answers.map((a) => a.user?.name ?? a.user?.id ?? "?");

    // The bot posts prompts but is never added as a member, so this is exactly the
    // humans - no filtering needed beyond it.
    const memberCount = Object.keys(channel.state.members).length;

    const send = async () => {
        const text = draft.trim();
        if (!text || sending) return;

        setSending(true);
        try {
            const { blocked } = await moderate(text);
            if (blocked) return;

            const response = await channel.sendMessage({
                text,
                messageType: "prompt_response",
                promptId: message.id,
            });

            setDraft("");
            setAnswering(false);

            if (response?.message?.id) {
                await finalizeSend({
                    cid: channel.cid,
                    messageId: response.message.id,
                    text,
                    promptId: message.id,
                });
            }
        } finally {
            setSending(false);
        }
    };

    const cancel = () => {
        setAnswering(false);
        setDraft("");
    };

    return (
        <div className="my-3 flex justify-center">
            {/* Deliberately not a `layout` element. Motion implements layout animation as
                a scale transform, so pairing it with a descendant animating real height
                runs two size animations against the same box: the card scales past the
                target while the height grows into it, then the projection snaps back.
                The height animations below own the growth on their own. */}
            <div className="w-full max-w-md rounded-card border border-bone-300 bg-surface p-4 shadow-card">
                <p className="flex items-center gap-1.5 text-label text-ink-600 uppercase">
                    <Lightbulb size={13} strokeWidth={1.5} aria-hidden />
                    Icebreaker
                </p>

                <p className="mt-1.5 text-body font-medium text-ink-900">{message.text}</p>

                {/* Count and button share a row: the button is secondary to the question,
                    and stacking it under the count put two competing things a few pixels
                    apart. The count applies to a 1:1 as much as a group — "1 of 2" is the
                    same nudge as "2 of 4", and leaving it out of DMs made the card look
                    like it was missing something. */}
                <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-meta text-ink-600">
                        <AvatarGroup names={answeredNames} size={20} />
                        <span className="truncate">
                            {answers.length} of {memberCount} answered
                            {!youAnswered && answers.length > 0 && " · answer to reveal"}
                        </span>
                    </p>

                    {!youAnswered && !answering && (
                        <button
                            type="button"
                            onClick={() => setAnswering(true)}
                            aria-expanded={answering}
                            // Only while open: the region is unmounted when collapsed, and
                            // pointing aria-controls at an id that is not in the document
                            // is a dangling reference.
                            aria-controls={answering ? regionId : undefined}
                            className="shrink-0 cursor-pointer rounded-full bg-accent-600 px-3.5 py-1 text-label text-surface transition-colors hover:bg-accent-700 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
                        >
                            Answer
                        </button>
                    )}
                </div>

                {answers.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2.5 border-t border-bone-200 pt-3">
                        <AnimatePresence initial={false}>
                            {answers.map((answer) => (
                                <motion.li
                                    key={answer.id}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    transition={transition}
                                    className="flex gap-2 overflow-hidden"
                                >
                                    <Avatar
                                        name={answer.user?.name ?? answer.user?.id ?? "?"}
                                        size={24}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-label text-ink-600">
                                            {answer.user?.id === client.userID
                                                ? "You"
                                                : (answer.user?.name ?? answer.user?.id)}
                                        </p>

                                        {youAnswered ? (
                                            <p className="text-meta wrap-break-word text-ink-900">
                                                {answer.text}
                                            </p>
                                        ) : (
                                            // The text is withheld from the markup, not
                                            // covered with a blur: a CSS filter is undone
                                            // by opening devtools, so it would be a
                                            // decoration pretending to be a mechanism.
                                            // Leaving it out is also the honest thing for
                                            // a screen reader, which a blur does nothing
                                            // about either way.
                                            <span className="mt-1 flex flex-col gap-1">
                                                <span className="sr-only">
                                                    Hidden until you answer
                                                </span>
                                                <span
                                                    aria-hidden
                                                    className="h-2 w-full rounded-full bg-bone-200"
                                                />
                                                <span
                                                    aria-hidden
                                                    className="h-2 w-2/3 rounded-full bg-bone-200"
                                                />
                                            </span>
                                        )}
                                    </div>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                )}

                {notice && (
                    <p role="alert" className="mt-3 text-meta text-red-700">
                        {notice.text}
                    </p>
                )}

                {!youAnswered && (
                    <AnimatePresence initial={false}>
                        {answering && (
                            <motion.div
                                key="answer-box"
                                id={regionId}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={transition}
                                className="overflow-hidden"
                            >
                                <div className="pt-3">
                                    <textarea
                                        ref={inputRef}
                                        value={draft}
                                        onChange={(event) => setDraft(event.target.value)}
                                        onKeyDown={(event) => {
                                            // Enter sends, Shift+Enter breaks the line —
                                            // what Stream's own composer does, so the two
                                            // inputs behave alike.
                                            if (event.key === "Enter" && !event.shiftKey) {
                                                event.preventDefault();
                                                void send();
                                            }
                                            if (event.key === "Escape") cancel();
                                        }}
                                        rows={2}
                                        maxLength={500}
                                        placeholder="Your answer…"
                                        aria-label="Your answer"
                                        className="w-full resize-none rounded-xl border border-bone-300 bg-bone-100 px-3 py-2 text-meta text-ink-900 outline-none transition-colors placeholder:text-ink-600 focus:border-accent-600 focus-visible:ring-2 focus-visible:ring-accent-600/40"
                                    />

                                    <div className="mt-2 flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={cancel}
                                            className="cursor-pointer rounded-full px-3 py-1.5 text-meta font-medium text-ink-600 transition-colors hover:bg-bone-200 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={send}
                                            disabled={!draft.trim() || sending}
                                            className="cursor-pointer rounded-full bg-accent-600 px-4 py-1.5 text-meta font-medium text-surface transition-colors hover:bg-accent-700 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-bone-300 disabled:text-ink-600"
                                        >
                                            {sending ? "Sending…" : "Send"}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}