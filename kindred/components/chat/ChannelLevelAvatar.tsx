"use client";

import { CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Event } from "stream-chat";
import { useChannelStateContext, useChatContext } from "stream-chat-react";

import GroupNameEditor from "@/components/chat/GroupNameEditor";
import { chatLevelToast, dailyBonusToast } from "@/components/chat/sharedToasts";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/ToastStack";
import { getChatLevel } from "@/lib/chat-level";
import {
    dailyBonusThreshold,
    dailyBonusXp,
    DAILY_MESSAGE_XP_CAP,
    XP_PER_MESSAGE,
    XP_PER_PROMPT_ANSWER,
} from "@/lib/confidence-xp";

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

    // UPDATED: Now listens for new messages from you to instantly refresh the stats
    useEffect(() => {
        const handleServerUpdate = () => refetch();
        
        const handleNewMessage = (event: Event) => {
            if (event.user?.id === client.userID) {
                // Wait 500ms for backend Prisma transaction to finish, then update UI
                setTimeout(refetch, 500);
            }
        };

        channel.on("chat_xp_updated", handleServerUpdate);
        channel.on("message.new", handleNewMessage);
        
        return () => {
            channel.off("chat_xp_updated", handleServerUpdate);
            channel.off("message.new", handleNewMessage);
        };
    }, [channel, client.userID, refetch]);

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

    const answeredPromptToday = !!messages?.some((m) => {
        if (m.user?.id !== client.userID || m.messageType !== "prompt_response") return false;
        return new Date(m.created_at || Date.now()).toDateString() === new Date().toDateString();
    });

    const maxMessagesReached = messagesToday >= DAILY_MESSAGE_XP_CAP;

    const panelTransition = reduceMotion
        ? { duration: 0 }
        : ({ duration: 0.2, ease: [0.22, 1, 0.36, 1] } as const);

    const springTransition = reduceMotion
        ? { duration: 0 }
        : ({ type: "spring", stiffness: 260, damping: 20 } as const);

    const containerVariants = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.05 } },
        exit: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: springTransition },
        exit: { opacity: 0, y: 10, scale: 0.98, transition: springTransition },
    };

    const displayTitle = userName || channel.data?.name || "Group";
    const frostedCardClasses = "rounded-card border border-ink-900/8 bg-surface/90 backdrop-blur-xl shadow-card p-4";

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
                        transition={panelTransition}
                        className="stroke-accent-600"
                    />
                </svg>

                <span className="relative flex items-center justify-center">
                    <Avatar name={displayTitle} size={avatar} />
                </span>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="chat-level-popover"
                        id={panelId}
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute top-full left-1/2 z-30 mt-2 flex w-64 -translate-x-1/2 flex-col gap-2 text-left"
                    >
                        {channel.type === "team" && channel.id && (
                            <motion.div variants={itemVariants} className={`${frostedCardClasses} !p-3`}>
                                <GroupNameEditor
                                    channelId={channel.id}
                                    name={channel.data?.name ?? "Group"}
                                />
                            </motion.div>
                        )}

                        <motion.div variants={itemVariants} className={frostedCardClasses}>
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
                        </motion.div>

                        <motion.div variants={itemVariants} className={frostedCardClasses}>
                            <p className="text-label text-ink-600 uppercase">
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
                        </motion.div>

                        <motion.div variants={itemVariants} className={frostedCardClasses}>
                            <p className="mb-3 text-label text-ink-600 uppercase">
                                Daily Tasks
                            </p>
                            
                            <div className="flex flex-col gap-4">
                                <div className="flex items-start gap-2.5">
                                    <CheckCircle2
                                        size={18}
                                        className={`mt-0.5 shrink-0 ${
                                            maxMessagesReached
                                                ? "fill-accent-600 text-surface"
                                                : "text-bone-300"
                                        }`}
                                    />
                                    <div className="flex min-w-0 w-full flex-col">
                                        <span className="text-meta text-ink-900">
                                            Max out daily messages
                                        </span>
                                        <div className="mt-0.5 text-label">
                                            <span className="font-semibold text-ink-900">
                                                +{XP_PER_MESSAGE} XP
                                            </span>
                                            <span className="ml-1 text-ink-600">
                                                (up to {DAILY_MESSAGE_XP_CAP} a day)
                                            </span>
                                        </div>
                                        
                                        {!maxMessagesReached && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="h-1.5 flex-1 rounded-full bg-bone-200/50">
                                                    <div
                                                        className="h-1.5 rounded-full bg-accent-600 transition-[width] duration-250 ease-smooth"
                                                        style={{
                                                            width: `${Math.min(1, messagesToday / DAILY_MESSAGE_XP_CAP) * 100}%`,
                                                        }}
                                                    />
                                                </div>
                                                <span className="tabular-nums text-label text-ink-600">
                                                    {Math.min(messagesToday, DAILY_MESSAGE_XP_CAP)}/{DAILY_MESSAGE_XP_CAP}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-start gap-2.5">
                                    <CheckCircle2
                                        size={18}
                                        className={`mt-0.5 shrink-0 ${
                                            answeredPromptToday 
                                                ? "fill-accent-600 text-surface" 
                                                : "text-bone-300"
                                        }`}
                                    />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="text-meta text-ink-900">
                                            Answer an icebreaker
                                        </span>
                                        <div className="mt-0.5 text-label">
                                            <span className="font-semibold text-ink-900">
                                                +{XP_PER_PROMPT_ANSWER} XP
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-2.5">
                                    <CheckCircle2
                                        size={18}
                                        className={`mt-0.5 shrink-0 ${
                                            bonusEarnedToday
                                                ? "fill-accent-600 text-surface"
                                                : "text-bone-300"
                                        }`}
                                    />
                                    <div className="flex min-w-0 w-full flex-col">
                                        <span className="text-meta text-ink-900">
                                            Everyone sends {bonusThreshold} messages
                                        </span>
                                        <div className="mt-0.5 text-label">
                                            <span className="font-semibold text-ink-900">
                                                +{dailyBonusXp(level)} XP
                                            </span>
                                        </div>
                                        
                                        {!bonusEarnedToday && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="h-1.5 flex-1 rounded-full bg-bone-200/50">
                                                    <div
                                                        className="h-1.5 rounded-full bg-accent-600 transition-[width] duration-250 ease-smooth"
                                                        style={{
                                                            width: `${Math.min(1, messagesToday / bonusThreshold) * 100}%`,
                                                        }}
                                                    />
                                                </div>
                                                <span className="tabular-nums text-label text-ink-600">
                                                    {Math.min(messagesToday, bonusThreshold)}/{bonusThreshold}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}