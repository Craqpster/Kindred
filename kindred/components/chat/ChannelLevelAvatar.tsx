"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
    ChannelAvatar,
    useChannelStateContext,
    useChatContext,
    type ChannelAvatarProps,
} from "stream-chat-react";

import Avatar from "@/components/ui/Avatar";
import { getChatLevel, XP_PER_LEVEL_STEP } from "@/lib/chat-level";
import { XP_PER_MESSAGE, XP_PER_PROMPT_ANSWER } from "@/lib/confidence-xp";

// Geometry of the ring. The avatar Stream renders at size="lg" is 40px; the ring sits
// just outside it, and the whole control is sized to the ring rather than the avatar.
const AVATAR_SIZE = 40;
const RING_STROKE = 3;
const RING_GAP = 3;
const BOX = AVATAR_SIZE + (RING_STROKE + RING_GAP) * 2;
const RADIUS = (BOX - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/// The channel's chat level, drawn as a progress ring around the header avatar.
///
/// Replaces the full-width bar that used to sit under the header. The bar competed with
/// the header for the same strip of attention and spent a whole row saying something that
/// is glanceable; a ring reads at a glance and gives the detail up only when asked.
///
/// Passed to <ChannelHeader Avatar={...} />, which is Stream's supported override - there
/// is no ChannelHeader key in ComponentContext. Handling it here rather than targeting
/// `.str-chat__avatar-group` in CSS matters: that class only exists for a group of 2+ with
/// no channel image, so a 1:1 chat renders a bare `.str-chat__avatar` and would have been
/// missed entirely.
export default function ChannelLevelAvatar(props: ChannelAvatarProps) {
    const { channel, messages } = useChannelStateContext();
    const { client } = useChatContext();
    const [xp, setXp] = useState<number | null>(null);
    const [open, setOpen] = useState(false);

    const reduceMotion = useReducedMotion();
    const panelId = useId();
    const containerRef = useRef<HTMLDivElement>(null);

    const refetch = useCallback(() => {
        fetch(`/api/chat-xp?channelCid=${encodeURIComponent(channel.cid)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data) setXp(data.xp);
            })
            .catch(() => {});
    }, [channel]);

    useEffect(refetch, [refetch, messages?.length]);

    // Fired once the award has actually landed (see useModeratedSend), for both people -
    // otherwise the refetch above races the write and reads the old number.
    useEffect(() => {
        const handle = () => refetch();
        channel.on("chat_xp_updated", handle);
        return () => channel.off("chat_xp_updated", handle);
    }, [channel, refetch]);

    // Dismissal for a hand-rolled popover: the project has no popover primitive, and
    // without both of these the panel can only be closed by clicking the ring again.
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    // The bot posts prompts but is never added as a member, so this is exactly the
    // humans. Same derivation ChatListRow uses; names are reliable without a DB round
    // trip because both startChatRequest and createGroupChannel upsert users with them.
    const members = Object.values(channel.state.members).map((member) => {
        const id = member.user_id ?? member.user?.id ?? "?";
        return {
            id,
            name: member.user?.name ?? id,
            isYou: id === client.userID,
        };
    });

    const { level, xpIntoLevel, xpForNextLevel } = getChatLevel(xp ?? 0);
    const progress = xpForNextLevel === 0 ? 0 : xpIntoLevel / xpForNextLevel;
    const remaining = xpForNextLevel - xpIntoLevel;

    const transition = reduceMotion
        ? { duration: 0 }
        : ({ duration: 0.2, ease: [0.22, 1, 0.36, 1] } as const);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                // Only while open — pointing at an id that is not in the document is a
                // dangling reference, and aria-expanded already carries the state.
                aria-controls={open ? panelId : undefined}
                aria-label={`Chat level ${level}. Show how chat XP is earned.`}
                style={{ width: BOX, height: BOX }}
                className="relative flex cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
            >
                <svg
                    width={BOX}
                    height={BOX}
                    viewBox={`0 0 ${BOX} ${BOX}`}
                    aria-hidden
                    className="absolute inset-0 -rotate-90"
                >
                    <circle
                        cx={BOX / 2}
                        cy={BOX / 2}
                        r={RADIUS}
                        fill="none"
                        strokeWidth={RING_STROKE}
                        className="stroke-bone-300"
                    />
                    <motion.circle
                        cx={BOX / 2}
                        cy={BOX / 2}
                        r={RADIUS}
                        fill="none"
                        strokeWidth={RING_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        // Drawn by shortening the dash offset rather than by animating a
                        // path, so it stays exact at 0% and 100%.
                        initial={false}
                        animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - progress) }}
                        transition={transition}
                        className="stroke-accent-600"
                    />
                </svg>

                {/* Wrapped, never given extra children: .str-chat__avatar-group lays its
                    tiles out with :has()/nth-child rules that any injected element would
                    break, and its ::after is already the presence dot.
                    role={undefined} because Stream hardcodes role="button" on the avatar,
                    which would otherwise nest a button inside this one. */}
                <span className="relative">
                    <ChannelAvatar {...props} role={undefined} size="lg" />
                </span>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        id={panelId}
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={transition}
                        className="absolute end-0 top-full z-30 mt-2 w-64 rounded-card border border-bone-300 bg-surface p-4 text-left shadow-hero"
                    >
                        {/* Who is actually here, first: clicking a face is a question
                            about people before it is a question about progress. */}
                        <p className="text-label text-ink-600 uppercase">
                            In this chat · {members.length}
                        </p>
                        <ul className="mt-2 flex flex-col gap-2">
                            {members.map((member) => (
                                <li key={member.id} className="flex items-center gap-2">
                                    <Avatar name={member.name} size={22} />
                                    <span className="truncate text-meta text-ink-900">
                                        {member.isYou ? "You" : member.name}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-3 border-t border-bone-200 pt-3 text-label text-ink-600 uppercase">
                            Chat level
                        </p>
                        <p className="mt-0.5 text-title text-ink-900">Level {level}</p>

                        <div className="mt-3 h-1.5 w-full rounded-full bg-bone-200">
                            <div
                                className="h-1.5 rounded-full bg-accent-600 transition-[width] duration-250 ease-smooth"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>

                        <p className="mt-2 text-meta text-ink-600">
                            {xpIntoLevel}/{xpForNextLevel} XP · {remaining} to go
                        </p>

                        <p className="mt-3 border-t border-bone-200 pt-3 text-label text-ink-600 uppercase">
                            How to earn
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-1 text-meta text-ink-600">
                            <li>+{XP_PER_MESSAGE} a real reply</li>
                            <li>+{XP_PER_PROMPT_ANSWER} answering an icebreaker</li>
                        </ul>

                        <p className="mt-3 text-label text-ink-600">
                            Each level costs {XP_PER_LEVEL_STEP} XP more than the last.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
