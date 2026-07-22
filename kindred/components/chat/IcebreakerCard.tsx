"use client";

import { Lightbulb, PenLine, Quote } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
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
/// Icon-only, per the convention KindredSendButton follows: an aria-label carries the
/// name and the glyph is hidden, so the control is announced as what it does rather than
/// as a punctuation mark.
const SPRING = { type: "spring", stiffness: 500, damping: 30, mass: 0.6 } as const;

const HOVER_QUERY = "(hover: hover)";

// Hover scale must not fire on touch, where there is no hover state to leave and the
// button would stay enlarged after a tap. Same guard Button.tsx uses.
function useHoverCapable() {
    return useSyncExternalStore(
        (onStoreChange) => {
            const query = window.matchMedia(HOVER_QUERY);
            query.addEventListener("change", onStoreChange);
            return () => query.removeEventListener("change", onStoreChange);
        },
        () => window.matchMedia(HOVER_QUERY).matches,
        () => false,
    );
}

/// The card's icon controls. Icon-only, per the convention KindredSendButton follows: an
/// aria-label carries the name and the glyph is hidden, so each is announced as what it
/// does rather than as a shape.
///
/// `filled` marks the primary action - answering - so it still reads as the thing to do
/// even without a text label.
function IconButton({
    label,
    icon: Icon,
    onClick,
    filled = false,
}: {
    label: string;
    icon: typeof Quote;
    onClick: () => void;
    filled?: boolean;
}) {
    const reduceMotion = useReducedMotion();
    const canHover = useHoverCapable();

    return (
        <motion.button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            whileHover={reduceMotion || !canHover ? undefined : { scale: 1.12 }}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            transition={SPRING}
            className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none ${
                filled
                    ? "bg-accent-600 text-surface hover:bg-accent-700"
                    : "text-ink-600 hover:bg-bone-200 hover:text-ink-900"
            }`}
        >
            <Icon size={14} strokeWidth={1.5} aria-hidden />
        </motion.button>
    );
}

export default function IcebreakerCard({ message }: { message: LocalMessage }) {
    const { channel, messages, highlightedMessageId } = useChannelStateContext();
    const { client } = useChatContext();
    const { moderate, finalizeSend, notice } = useModeratedSend();

    const [answering, setAnswering] = useState(false);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    // Whether the answer box has finished opening; see the region's onAnimationComplete.
    const [boxSettled, setBoxSettled] = useState(false);

    const reduceMotion = useReducedMotion();
    const regionId = useId();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

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

    // Answerers, not answers. Quoting a prompt lets the same person answer it more than
    // once, so mapping over `answers` counted one of them twice - which showed their face
    // twice and let "N of M answered" climb past M. Both are questions about *people*.
    const answeredNames = [
        ...new Map(
            answers.map((a) => [
                a.user?.id ?? a.id,
                { name: a.user?.name ?? a.user?.id ?? "?" },
            ]),
        ).values(),
    ];

    // The bot posts prompts but is never added as a member, so this is exactly the
    // humans - no filtering needed beyond it.
    const memberCount = Object.keys(channel.state.members).length;

    // Jumping to a quote targets a message id. That id is the prompt when someone quoted
    // the icebreaker, but an ANSWER when they quoted a reply - and answers have no node of
    // their own, since they render inside this card. So the card answers for both.
    //
    // Stream's own highlight is no help here either: it applies a class inside MessageUI,
    // which this component deliberately replaces, so it never reaches us.
    const isHighlighted =
        !!highlightedMessageId &&
        (highlightedMessageId === message.id ||
            answers.some((a) => a.id === highlightedMessageId));

    // Stream scrolls to the <li> wrapper, which for a quoted answer is an empty hairline -
    // centring it leaves the card framed by accident. Re-centring on the card itself is
    // what actually puts the thing you asked for in front of you.
    useEffect(() => {
        if (!isHighlighted) return;
        cardRef.current?.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "center",
        });
    }, [isHighlighted, reduceMotion]);

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
            closeAnswerBox();

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

    // Every open and every close goes through these two, so the clip is always back in
    // place before a height animation runs and only lifted once one has finished.
    const openAnswerBox = () => {
        setBoxSettled(false);
        setAnswering(true);
    };

    const closeAnswerBox = () => {
        setBoxSettled(false);
        setAnswering(false);
    };

    const cancel = () => {
        closeAnswerBox();
        setDraft("");
    };

    return (
        <div className="my-3 flex justify-center">
            {/* Deliberately not a `layout` element. Motion implements layout animation as
                a scale transform, so pairing it with a descendant animating real height
                runs two size animations against the same box: the card scales past the
                target while the height grows into it, then the projection snaps back.
                The height animations below own the growth on their own. */}
            <div
                ref={cardRef}
                // The pulse itself lives in globals.css as a keyframe, so the animation
                // and the reduced-motion fallback sit next to each other rather than
                // being split between a stylesheet and inline styles here.
                className={`w-full max-w-md rounded-card border border-bone-300 bg-surface p-4 shadow-card ${
                    isHighlighted ? "kindred-card-highlight" : ""
                }`}
            >
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
                        <AvatarGroup 
                            users={answeredNames.map((item) => ({ name: item.name }))} 
                            size={20} 
                        />
                        <span className="truncate">
                            {answeredNames.length} of {memberCount} answered
                            {!youAnswered && answers.length > 0 && " · answer to reveal"}
                        </span>
                    </p>

                    <span className="flex shrink-0 items-center gap-1">
                        {/* Quoting puts the question above the main composer, which is the
                            only way to answer a prompt that has scrolled out of reach of
                            this card, or to add a second thought after the inline box is
                            gone. ModeratedMessageComposer notices the quote and tags the
                            send as an answer, so it still lands back in this card. */}
                        <IconButton
                            label="Quote this icebreaker"
                            icon={Quote}
                            onClick={() => channel.messageComposer.setQuotedMessage(message)}
                        />

                        {/* Filled, so the primary action still reads as primary now that
                            it has no text label. The trade is real: an icon is less
                            discoverable than the word "Answer", which is why it keeps both
                            an aria-label and a title. */}
                        {!youAnswered && !answering && (
                            <IconButton
                                label="Answer this icebreaker"
                                icon={PenLine}
                                onClick={openAnswerBox}
                                filled
                            />
                        )}
                    </span>
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
                                    className="flex flex-col overflow-hidden"
                                >
                                    {/* Avatar and name on one centred row. Previously the
                                        avatar sat beside the whole block, so it aligned to
                                        the top of a two-line column and the name appeared
                                        pushed down relative to it. */}
                                    <div className="flex items-center gap-2 text-label text-ink-600">
                                        <Avatar
                                            name={answer.user?.name ?? answer.user?.id ?? "?"}
                                            size={24}
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {answer.user?.id === client.userID
                                                ? "You"
                                                : (answer.user?.name ?? answer.user?.id)}
                                        </span>

                                        {/* Only on answers that are actually legible:
                                            offering to quote text the viewer cannot read
                                            would be a button that produces a blank. Unlike
                                            quoting the prompt, this is an ordinary reply -
                                            the composer only tags a send as an answer when
                                            the quoted message is the icebreaker itself, so
                                            this earns the usual +1 and stays in the
                                            timeline. */}
                                        {youAnswered && (
                                            <IconButton
                                                label={`Quote ${answer.user?.name ?? "this answer"}`}
                                                icon={Quote}
                                                onClick={() =>
                                                    channel.messageComposer.setQuotedMessage(
                                                        answer,
                                                    )
                                                }
                                            />
                                        )}
                                    </div>

                                    {/* Indented to clear the 24px avatar plus its 8px gap,
                                        so the answer hangs under the name rather than
                                        under the face. */}
                                    <div className="mt-1 pl-8">
                                        {youAnswered ? (
                                            <p className="text-meta wrap-break-word text-ink-900">
                                                {answer.text}
                                            </p>
                                        ) : (
                                            // Replaced the placeholder lines with clean text
                                            <p className="text-meta italic text-ink-600">
                                                Hidden until you answer
                                            </p>
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
                                // The clip is only needed WHILE the height animates - kept
                                // afterwards it shaves the textarea's focus ring, which
                                // draws outside the element's box. Dropped once the open
                                // animation settles and restored the moment a collapse
                                // begins, so the ring is whole for the entire time the box
                                // is actually usable.
                                onAnimationComplete={() => setBoxSettled(true)}
                                className={boxSettled ? undefined : "overflow-hidden"}
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