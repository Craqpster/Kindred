"use client";

import { MessageCircle, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import Avatar from "@/components/ui/Avatar";

// A floating frosted dock: a horizontal bar at the bottom on mobile (thumb reach), a
// vertical rail centred on the left edge on desktop.
//
// It sits OVER the content — see app/(app)/layout.tsx — because backdrop-blur has
// nothing to blur unless content passes behind it. <main> reserves the matching edge
// (bottom on mobile, left on desktop) so the collapsed rail never covers anything.
//
// Collapsed it is icons only. Hovering (or tabbing into) the rail expands the WHOLE
// dock at once and springs every label open beside its icon — one deliberate motion,
// rather than each row twitching on its own hover.

const TABS = [
    { href: "/meet", label: "Meet", Icon: Users },
    { href: "/chats", label: "Chats", Icon: MessageCircle },
];

// The nav's variant propagates through the tree to every label, so the plain <Link>s in
// between need no wiring. staggerChildren fans the labels out in sequence, and reverses
// on the way back in so they collapse from the bottom up.
const NAV_VARIANTS = {
    rest: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
    expanded: { transition: { staggerChildren: 0.04 } },
};

// width: "auto" is measured by motion, so each label springs out to the width its own
// text needs — "Chats" travels further than "Me".
const LABEL_VARIANTS = {
    rest: { width: 0, opacity: 0, marginLeft: 0 },
    expanded: { width: "auto", opacity: 1, marginLeft: 8 },
};

export default function AppDock({ username }: { username: string }) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    // One state for the whole rail. onFocus/onBlur are React's bubbling versions, so
    // tabbing to any link inside expands the dock too — without this the labels would be
    // unreachable by keyboard.
    const [expanded, setExpanded] = useState(false);

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    const spring = (stiffness: number, damping: number) =>
        reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness, damping };

    // One shared element: motion matches it across items by layoutId and springs it to
    // the new position, so the indicator travels rather than cross-fading.
    const pill = (
        <motion.span
            layoutId="dock-pill"
            className="absolute inset-0 rounded-xl bg-star-sapphire"
            // A spring that ignores the OS reduce-motion setting is an accessibility
            // regression, so drop to an instant move instead.
            transition={spring(400, 32)}
        />
    );

    // overflow-hidden clips the text while the width animates; whitespace-nowrap stops it
    // wrapping mid-spring. Hidden entirely on mobile, where there is no hover to expand it.
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
            active ? "text-white" : "text-star-sapphire hover:bg-mist"
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
                "rounded-2xl border border-white/60 bg-white/60 px-2 py-1.5 backdrop-blur-xl " +
                // Desktop: vertical rail, centred on the left edge. translate-x-0 is
                // required — without it the mobile centring transform carries into this
                // breakpoint and pulls the rail half off-screen.
                // items-stretch so every row matches the widest once expanded.
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

            {/* The avatar is the Me item. */}
            <Link
                href="/me"
                aria-label="Me"
                aria-current={isActive("/me") ? "page" : undefined}
                className={itemClass(isActive("/me"))}
            >
                {isActive("/me") && pill}
                <span className="relative z-10 flex shrink-0 items-center">
                    <Avatar name={username} size={20} />
                </span>
                {label("Me")}
            </Link>
        </motion.nav>
    );
}