"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Avatar from "@/components/ui/Avatar";

const TABS = [
    { href: "/meet", label: "Meet" },
    { href: "/chats", label: "Chats" },
    { href: "/me", label: "Me" },
];

export default function SidebarNav({ username }: { username: string }) {
    const pathname = usePathname();

    return (
        <aside className="flex w-full shrink-0 flex-row items-center justify-between gap-1 bg-flour px-4 py-3 sm:h-screen sm:w-56 sm:flex-col sm:items-stretch sm:justify-start sm:gap-2 sm:px-3 sm:py-6">
            <div className="hidden px-3 pb-4 text-lg font-bold text-star-sapphire sm:block">
                Kindred
            </div>

            <nav className="flex flex-row gap-1 sm:flex-col sm:gap-1">
                {TABS.map((tab) => {
                    const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            aria-current={active ? "page" : undefined}
                            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                active
                                    ? "bg-star-sapphire text-white"
                                    : "text-star-sapphire hover:bg-mist"
                            }`}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="flex items-center gap-2 sm:mt-auto sm:px-2">
                <Avatar name={username} size={32} />
                <span className="hidden truncate text-sm text-gray-600 sm:block">{username}</span>
            </div>
        </aside>
    );
}