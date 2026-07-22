"use client";

import { MessageCircle, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import Avatar from "@/components/ui/Avatar";

const TABS = [
    { href: "/meet", label: "Meet", Icon: Users },
    { href: "/chats", label: "Chats", Icon: MessageCircle },
];

const NAV_VARIANTS = {
    rest: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
    expanded: { transition: { staggerChildren: 0.04 } },
};

const LABEL_VARIANTS = {
    rest: { width: 0, opacity: 0, marginLeft: 0 },
    expanded: { width: "auto", opacity: 1, marginLeft: 8 },
};

export default function AppDock({ 
    username, 
    avatarId, 
    avatarSeed 
}: { 
    username: string; 
    avatarId?: string | null; 
    avatarSeed?: string | null; 
}) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    const [expanded, setExpanded] = useState(false);

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    const spring = (stiffness: number, damping: number) =>
        reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness, damping };

    const pill = (
        <motion.span
            layoutId="dock-pill"
            className="absolute inset-0 rounded-xl bg-star-sapphire"
            transition={spring(400, 32)}
        />
    );

    const label = (text: string) => (
        <motion.span
            variants={LABEL_VARIANTS}
            transition={spring(500, 30)}
            className="relative z-10 hidden overflow-hidden text-sm font-medium whitespace-nowrap sm:block"
        >
            {text}
        </motion.span>
    );

    const itemClass = (active: boolean) =>
        `relative flex items-center rounded-xl p-2.5 ${
            active ? "text-white" : "text-star-sapphire/70 hover:bg-star-sapphire/5 hover:text-star-sapphire"
        }`;

    return (
        <motion.nav
            aria-label="Main"
            variants={NAV_VARIANTS}
            initial="rest"
            animate={expanded ? "expanded" : "rest"}
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            onFocus={() => setExpanded(true)}
            onBlur={() => setExpanded(false)}
            className={
                "absolute bottom-4 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-1 " +
                "rounded-card border border-star-sapphire/10 bg-surface/80 px-2 py-1.5 shadow-card backdrop-blur-xl " +
                "sm:top-1/2 sm:bottom-auto sm:left-4 sm:-translate-y-1/2 sm:translate-x-0 sm:flex-col sm:items-stretch"
            }
        >
            {TABS.map(({ href, label: text, Icon }) => {
                const active = isActive(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-label={text}
                        aria-current={active ? "page" : undefined}
                        className={itemClass(active)}
                    >
                        {active && pill}
                        <Icon size={20} aria-hidden className="relative z-10 shrink-0" />
                        {label(text)}
                    </Link>
                );
            })}

            {/* The avatar is the Me item, now pulling the database configuration */}
            <Link
                href="/me"
                aria-label="Me"
                aria-current={isActive("/me") ? "page" : undefined}
                className={itemClass(isActive("/me"))}
            >
                {isActive("/me") && pill}
                <span className="relative z-10 flex shrink-0 items-center">
                    <Avatar 
                        name={username} 
                        avatarId={avatarId} 
                        avatarSeed={avatarSeed} 
                        size={20} 
                    />
                </span>
                {label("Me")}
            </Link>
        </motion.nav>
    );
}