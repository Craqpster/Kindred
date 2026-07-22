"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { ProfileWithRelations } from "@/lib/dal";

export function BadgesSection({
    profileBadges,
}: {
    profileBadges: ProfileWithRelations["profile_badges"];
}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (isExpanded && cardRef.current) {
            cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [isExpanded]);

    const unlockHints: Record<string, string> = {
        "Ice Breaker": "Say hi to someone 👋",
        "Social Butterfly": "Reach Tier 2 🦋",
        "Kindred Spirit": "Reach Tier 3 ✨",
        "Early Bird": "Be active before 9am ⏰",
        "Night Owl": "Be active before 3am 🌙",
        "Community Helper": "Help in a group chat 🛠️",
        "Daily Streak": "Log in 3 days in a row 🔥",
        "Game Starter": "Start a game 🎲",
        "Game Winner": "Win a game 🏆",
        "Chat Explorer": "Visit 5 unique rooms 🧭",
        "Emoji Master": "Send 50 emoji messages 😄",
        "Conversation Starter": "Start 10 chats 💬",
        "Friend Maker": "Make 3 friends 🌿",
    };

    const order = [
        "Ice Breaker", "Social Butterfly", "Kindred Spirit", "Early Bird",
        "Night Owl", "Community Helper", "Daily Streak", "Game Starter",
        "Game Winner", "Chat Explorer", "Emoji Master", "Conversation Starter", "Friend Maker",
    ];

    const unlockedNames = new Set(
        (profileBadges || []).map((pb) => pb?.badge?.name).filter(Boolean) as string[]
    );

    return (
        <div ref={cardRef}>
            <div
                className="flex justify-between items-center cursor-pointer group select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div>
                    <h2 className="font-display text-xl font-bold text-star-sapphire">Achievements & Badges</h2>
                    <p className="text-sm text-star-sapphire/70">See all badges and how to unlock them</p>
                </div>
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}>
                    <ChevronDown className="h-5 w-5 text-star-sapphire/40 group-hover:text-star-sapphire transition-colors" />
                </motion.div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden pt-6"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {order.map((name) => {
                                const found = (profileBadges || []).find((pb) => pb?.badge?.name === name);
                                const b = found?.badge || { name, description: "", icon: "" };
                                const unlocked = unlockedNames.has(name);
                                const unlockInfo = unlockHints[name] || b.description || "";
                                const title = unlocked ? b.description || unlockInfo : `Locked — ${unlockInfo}`;

                                return (
                                    <div
                                        key={name}
                                        title={title}
                                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                                            unlocked 
                                                ? "border-star-sapphire/15 bg-bone-100 shadow-sm opacity-100" 
                                                : "border-star-sapphire/5 bg-bone-100/30 opacity-40 grayscale cursor-default"
                                        }`}
                                    >
                                        {b.icon && <div className="text-3xl mb-2">{b.icon}</div>}
                                        <h3 className="font-bold text-xs text-star-sapphire">{b.name}</h3>
                                        <p className="text-[11px] text-star-sapphire/70 mt-1 leading-snug">
                                            {unlocked ? b.description || unlockInfo : unlockInfo}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}