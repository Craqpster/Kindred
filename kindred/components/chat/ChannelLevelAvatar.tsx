"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
// Stream's Event, not the DOM's - the global one shadows it otherwise.
import type { Event } from "stream-chat";
import { useChannelStateContext, useChatContext } from "stream-chat-react";

import GroupNameEditor from "@/components/chat/GroupNameEditor";
import { chatLevelToast, dailyBonusToast } from "@/components/chat/sharedToasts";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/ToastStack";
import { getChatLevel, XP_PER_LEVEL_STEP } from "@/lib/chat-level";
import {
    dailyBonusThreshold,
    dailyBonusXp,
    DAILY_MESSAGE_XP_CAP,
    XP_PER_MESSAGE,
    XP_PER_PROMPT_ANSWER,
} from "@/lib/confidence-xp";

// Geometry of the ring, derived rather than hardcoded so the two sizes cannot drift out
// of proportion with each other. The ring sits OUTSIDE the avatar, so the whole control
// measures larger than the avatar it wraps - which is what the header has to make room
// for.
//
// "compact" exists for the floating channel pill: at 40px the ring makes the pill as tall
// as the header it replaced, which defeats the point of floating it.
const RING_SIZES = {
    default: { avatar: 40, stroke: 3, gap: 3 },
    compact: { avatar: 28, stroke: 2, gap: 2 },
};

export type RingSize = keyof typeof RING_SIZES;

function ringGeometry(size: RingSize) {
    const { avatar, stroke, gap } = RING_SIZES[size];
    const box = avatar + (stroke + gap) * 2;
    const radius = (box - stroke) / 2;

    return { box, radius, stroke, avatar, circumference: 2 * Math.PI * radius };
}

/// The channel's chat level, drawn as a progress ring around the header avatar.
///
/// Replaces the full-width bar that used to sit under the header. The bar competed with
/// the header for the same strip of attention and spent a whole row saying something that
/// is glanceable; a ring reads at a glance and gives the detail up only when asked.
/// Takes only what it uses. It used to accept ChannelAvatarProps and forward the lot to
/// Stream's ChannelAvatar, but that rendered a cramped stack of tiny faces in a group;
/// one deterministic initials avatar sized to the ring reads far better at this size, and
/// the popover lists everyone by name anyway. displayMembers/imageUrl went with it rather
/// than lingering as props nothing reads.
export default function ChannelLevelAvatar({
    ringSize = "default",
    userName,
}: {
    ringSize?: RingSize;
    userName?: string;
}) {
    const { box, radius, stroke, avatar, circumference } = ringGeometry(ringSize);
    const { channel, messages } = useChannelStateContext();
    const { client } = useChatContext();
    const { showToast } = useToast();
    const [xp, setXp] = useState<number | null>(null);
    const [messagesToday, setMessagesToday] = useState(0);
    const [bonusEarnedToday, setBonusEarnedToday] = useState(false);
    const [open, setOpen] = useState(false);

    const reduceMotion = useReducedMotion();
    const panelId = useId();
    const containerRef = useRef<HTMLDivElement>(null);

    const refetch = useCallback(() => {
        fetch(`/api/chat-xp?channelCid=${encodeURIComponent(channel.cid)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!data) return;
                setXp(data.xp);
                setMessagesToday(data.messagesToday ?? 0);
                setBonusEarnedToday(!!data.bonusEarnedToday);
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

    // Advancements that belong to the whole channel.
    useEffect(() => {
        const handleLevel = (event: Event) => {
            if (event.user?.id === client.userID) return;
            if (event.chatLevel) showToast(chatLevelToast(event.chatLevel));
            refetch();
        };

        const handleBonus = (event: Event) => {
            if (event.user?.id === client.userID) return;
            if (event.bonusXp) showToast(dailyBonusToast(event.bonusXp));
            refetch();
        };

        channel.on("chat_level_up", handleLevel);
        channel.on("chat_daily_bonus", handleBonus);
        return () => {
            channel.off("chat_level_up", handleLevel);
            channel.off("chat_daily_bonus", handleBonus);
        };
    }, [channel, client.userID, refetch, showToast]);

    // Dismissal for a hand-rolled popover
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

    const members = Object.values(channel.state.members).map((member) => {
        const id = member.user_id ?? member.user?.id ?? "?";
        return {
            id,
            name: member.user?.name ?? id,
            isYou: id === client.userID,
        };
    });

    const { level, xpIntoLevel, xpForNextLevel } = getChatLevel(xp ?? 0);
    const bonusThreshold = dailyBonusThreshold(level);
    const progress = xpForNextLevel === 0 ? 0 : xpIntoLevel / xpForNextLevel;
    const remaining = xpForNextLevel - xpIntoLevel;

    const transition = reduceMotion
        ? { duration: 0 }
        : ({ duration: 0.2, ease: [0.22, 1, 0.36, 1] } as const);

    // Fallback order for the name: explicitly passed userName -> channel name -> "Group"
    const displayTitle = userName || channel.data?.name || "Group";

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={`Chat level ${level}. Show how chat XP is earned.`}
                style={{ width: box, height: box }}
                className="relative flex cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
            >
                <svg
                    width={box}
                    height={box}
                    viewBox={`0 0 ${box} ${box}`}
                    aria-hidden
                    className="absolute inset-0 -rotate-90"
                >
                    <circle
                        cx={box / 2}
                        cy={box / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        className="stroke-bone-300"
                    />
                    <motion.circle
                        cx={box / 2}
                        cy={box / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={false}
                        animate={{ strokeDashoffset: circumference * (1 - progress) }}
                        transition={transition}
                        className="stroke-accent-600"
                    />
                </svg>

                {/* Swapped Stream's ChannelAvatar with your custom Avatar.
                    It uses the explicit width/height derived from the ring geometry. */}
                <span className="relative flex items-center justify-center">
                    <Avatar name={displayTitle} size={avatar} />
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
                        className="absolute top-full left-1/2 z-30 mt-2 w-64 -translate-x-1/2 rounded-card border border-bone-300 bg-surface p-4 text-left shadow-hero"
                    >
                        {/* Groups only */}
                        {channel.type === "team" && channel.id && (
                            <div className="mb-3 border-b border-bone-200 pb-3">
                                <GroupNameEditor
                                    channelId={channel.id}
                                    name={channel.data?.name ?? "Group"}
                                />
                            </div>
                        )}

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
                            <li>
                                +{XP_PER_MESSAGE} a real reply, up to {DAILY_MESSAGE_XP_CAP} a
                                day
                            </li>
                            <li>+{XP_PER_PROMPT_ANSWER} answering an icebreaker</li>
                            <li>
                                +{dailyBonusXp(level)} when you all send {bonusThreshold} today
                            </li>
                        </ul>

                        <div className="mt-3 rounded-xl bg-bone-100 px-3 py-2">
                            {bonusEarnedToday ? (
                                <p className="text-meta text-ink-900">
                                    Daily bonus earned · see you tomorrow
                                </p>
                            ) : (
                                <>
                                    <p className="text-meta text-ink-900">
                                        {Math.min(messagesToday, bonusThreshold)}/
                                        {bonusThreshold} messages today
                                    </p>
                                    <div className="mt-1.5 h-1 w-full rounded-full bg-bone-200">
                                        <div
                                            className="h-1 rounded-full bg-accent-600 transition-[width] duration-250 ease-smooth"
                                            style={{
                                                width: `${Math.min(1, messagesToday / bonusThreshold) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="mt-1 text-label text-ink-600">
                                        Everyone here has to reach it
                                    </p>
                                </>
                            )}
                        </div>

                        <p className="mt-3 text-label text-ink-600">
                            Each level costs {XP_PER_LEVEL_STEP} XP more than the last.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}