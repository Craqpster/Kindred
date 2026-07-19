"use client";

import { MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import Avatar from "@/components/ui/Avatar";

// A floating frosted dock
//
// The published component animates a single shared pill between items via layoutId.
// Here each item owns its own pill and cross-fades with transition-colors 
//
// Bottom on mobile (thumb reach), top on desktop. Either way it sits OVER the scrolling
// content — see app/(app)/layout.tsx — because backdrop-blur has nothing to blur unless
// content passes behind it.

const TABS = [
    { href: "/meet", label: "Meet", Icon: Users },
    { href: "/chats", label: "Chats", Icon: MessageCircle },
];

export default function AppDock({ username }: { username: string }) {
    const pathname = usePathname();
    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    const itemClass = (active: boolean) =>
        `flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
            active ? "bg-star-sapphire text-white" : "text-star-sapphire hover:bg-mist"
        }`;

    return (
        <nav
            aria-label="Main"
            className="absolute bottom-4 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/60 bg-white/60 px-2 py-1.5 shadow-lg backdrop-blur-xl sm:top-4 sm:bottom-auto"
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
                        <Icon size={18} aria-hidden />
                        {/* Labels are desktop-only: three items stay unambiguous on a wide
                            screen, and the bottom dock stays compact on a narrow one. */}
                        <span className="hidden text-sm font-medium sm:inline">{label}</span>
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
                <Avatar name={username} size={18} />
                <span className="hidden text-sm font-medium sm:inline">Me</span>
            </Link>
        </nav>
    );
}