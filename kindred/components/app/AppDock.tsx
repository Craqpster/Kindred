"use client";

import { MessageCircle, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import Avatar from "@/components/ui/Avatar";

// A floating frosted dock: a horizontal bar at the bottom on mobile (thumb reach), a
// vertical rail centred on the left edge on desktop.
//
// It sits OVER the content — see app/(app)/layout.tsx — because backdrop-blur has
// nothing to blur unless content passes behind it. <main> reserves the matching edge
// (bottom on mobile, left on desktop) so nothing is ever covered.
//
// Icons only, on both breakpoints. title + aria-label carry the meaning that the
// dropped text labels used to.

const TABS = [
    { href: "/meet", label: "Meet", Icon: Users },
    { href: "/chats", label: "Chats", Icon: MessageCircle },
];

export default function AppDock({ username }: { username: string }) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    // One shared element: motion matches it across items by layoutId and springs it to
    // the new position, so the indicator travels rather than cross-fading. layoutId
    // handles the vertical travel on desktop with no extra configuration.
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
        `relative flex items-center justify-center rounded-xl p-2.5 ${
            active ? "text-white" : "text-star-sapphire hover:bg-mist"
        }`;

    return (
        <nav
            aria-label="Main"
            className={
                "absolute bottom-4 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-1 " +
                "rounded-2xl border border-white/60 bg-white/60 px-2 py-1.5 backdrop-blur-xl " +
                // Desktop: vertical rail, centred on the left edge. translate-x-0 is
                // required — without it the mobile centring transform carries into this
                // breakpoint and pulls the rail half off-screen.
                "sm:top-1/2 sm:bottom-auto sm:left-4 sm:-translate-y-1/2 sm:translate-x-0 sm:flex-col"
            }
        >
            {TABS.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        title={label}
                        aria-label={label}
                        aria-current={active ? "page" : undefined}
                        className={itemClass(active)}
                    >
                        {active && pill}
                        <Icon size={20} aria-hidden className="relative z-10" />
                    </Link>
                );
            })}

            {/* The avatar is the Me item. */}
            <Link
                href="/me"
                title="Me"
                aria-label="Me"
                aria-current={isActive("/me") ? "page" : undefined}
                className={itemClass(isActive("/me"))}
            >
                {isActive("/me") && pill}
                <span className="relative z-10 flex items-center">
                    <Avatar name={username} size={20} />
                </span>
            </Link>
        </nav>
    );
}