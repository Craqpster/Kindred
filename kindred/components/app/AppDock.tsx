"use client";

import { MessageCircle, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import Avatar from "@/components/ui/Avatar";

// A floating frosted dock: bottom on mobile (thumb reach), top on desktop.
//
// Three behaviours keep it from fighting the content instead of hiding it outright:
//   - dimmed while idle, full opacity on hover or keyboard focus
//   - slides away while scrolling down, returns on scroll up
//   - the active pill physically travels between items on a spring

const TABS = [
    { href: "/meet", label: "Meet", Icon: Users },
    { href: "/chats", label: "Chats", Icon: MessageCircle },
];

const SCROLL_CONTAINER_ID = "app-scroll";

/// Tracks whether the user is scrolling down, so the dock can get out of the way.
/// Routes whose <main> never scrolls (/chats — Stream's message list scrolls itself)
/// simply emit no events, so the dock stays put there. No route special-casing needed.
function useHideOnScrollDown() {
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const scroller = document.getElementById(SCROLL_CONTAINER_ID);
        if (!scroller) return;

        let last = scroller.scrollTop;

        const onScroll = () => {
            const current = scroller.scrollTop;
            // Ignore jitter, and never hide near the top where there is nothing to reveal.
            if (Math.abs(current - last) > 8) {
                setHidden(current > last && current > 64);
                last = current;
            }
        };

        scroller.addEventListener("scroll", onScroll, { passive: true });
        return () => scroller.removeEventListener("scroll", onScroll);
    }, []);

    return hidden;
}

export default function AppDock({ username }: { username: string }) {
    const pathname = usePathname();
    const hidden = useHideOnScrollDown();
    const reduceMotion = useReducedMotion();

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    // The pill is one shared element: motion matches it across items by layoutId and
    // springs it to the new position, so the indicator travels rather than cross-fading.
    const pill = (
        <motion.span
            layoutId="dock-pill"
            className="absolute inset-0 rounded-xl bg-star-sapphire"
            // A spring that ignores the OS reduce-motion setting is an accessibility
            // regression, so drop to an instant move instead.
            transition={
                reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 32 }
            }
        />
    );

    const itemClass = (active: boolean) =>
        `relative flex items-center gap-2 rounded-xl px-3 py-2 ${
            active ? "text-white" : "text-star-sapphire hover:bg-mist"
        }`;

    return (
        <nav
            aria-label="Main"
            data-hidden={hidden}
            className={
                "absolute bottom-4 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-1 " +
                "rounded-2xl border border-white/60 bg-white/60 px-2 py-1.5 backdrop-blur-xl " +
                // Dimmed while idle so it stops competing with content, but never hidden:
                // focus-within is what keeps it reachable by keyboard.
                "opacity-40 transition-[opacity,transform] duration-300 hover:opacity-100 focus-within:opacity-100 " +
                // Slide off whichever edge it lives on.
                "data-[hidden=true]:translate-y-24 sm:top-4 sm:bottom-auto sm:data-[hidden=true]:-translate-y-24"
            }
        >
            {TABS.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={itemClass(active)}
                    >
                        {active && pill}
                        <Icon size={18} aria-hidden className="relative z-10" />
                        {/* Labels are desktop-only: three items stay unambiguous on a wide
                            screen, and the bottom dock stays compact on a narrow one. */}
                        <span className="relative z-10 hidden text-sm font-medium sm:inline">
                            {label}
                        </span>
                    </Link>
                );
            })}

            {/* The avatar is the Me item. It keeps its label so it reads as a profile
                link rather than decoration. */}
            <Link
                href="/me"
                aria-current={isActive("/me") ? "page" : undefined}
                className={itemClass(isActive("/me"))}
            >
                {isActive("/me") && pill}
                <span className="relative z-10 flex items-center">
                    <Avatar name={username} size={18} />
                </span>
                <span className="relative z-10 hidden text-sm font-medium sm:inline">Me</span>
            </Link>
        </nav>
    );
}