"use client";

import { Gamepad2, Lightbulb, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { sendIcebreaker } from "@/app/(app)/chats/actions";
import { startGame } from "@/app/(app)/chats/game-actions";
import { GAME_TYPES, GAMES, type GameType } from "@/components/chat/games/registry";

/// Everything you can put into a conversation that is not typed.
///
/// A menu rather than a row of buttons: the composer is where someone goes to say something,
/// and lining extra affordances up next to the text box competes with that. One control that
/// opens when asked keeps the default action obvious.
export default function ComposerMenu({ conversationId }: { conversationId: string }) {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Click-outside and Escape, only while open — an app-wide listener that exists whether or
    // not anything is showing is a listener that runs on every click in the app.
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const requestIcebreaker = async () => {
        if (sending) return;
        setSending(true);
        // Closed straight away rather than on completion: the prompt arrives in the timeline
        // over realtime, so the menu hanging around waiting for it would be the slowest part
        // of an otherwise instant action.
        setOpen(false);

        try {
            await sendIcebreaker(conversationId);
        } finally {
            setSending(false);
        }
    };

    const invite = async (gameType: GameType) => {
        if (sending) return;
        setSending(true);
        setOpen(false);

        try {
            // The invite is an ordinary message, so it arrives in the timeline over realtime
            // like anything else — there is nothing to add to the thread by hand.
            await startGame({ conversationId, gameType });
        } finally {
            setSending(false);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-label="Add to this conversation"
                aria-expanded={open}
                aria-haspopup="menu"
                className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-bone-300 text-ink-900 transition-[background-color,transform] hover:bg-bone-200 ${
                    open ? "rotate-45 bg-bone-200" : ""
                }`}
            >
                <Plus size={21} strokeWidth={1.5} aria-hidden />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute bottom-13 left-0 z-10 w-56 overflow-hidden rounded-card border border-bone-300 bg-surface shadow-hero"
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={requestIcebreaker}
                        disabled={sending}
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-meta text-ink-900 transition-colors hover:bg-bone-100 disabled:opacity-60"
                    >
                        <Lightbulb size={16} strokeWidth={1.5} aria-hidden className="text-accent-600" />
                        Send an icebreaker
                    </button>

                    {/* One row per game rather than a submenu. There are two, and a menu that
                        opens another menu to show two things is a menu doing too much. */}
                    <div className="border-t border-bone-200">
                        <p className="flex items-center gap-2.5 px-3 pt-2.5 pb-1 text-label uppercase text-ink-600">
                            <Gamepad2 size={16} strokeWidth={1.5} aria-hidden />
                            Play a game
                        </p>

                        {GAME_TYPES.map((gameType) => (
                            <button
                                key={gameType}
                                type="button"
                                role="menuitem"
                                onClick={() => invite(gameType)}
                                disabled={sending}
                                className="flex w-full cursor-pointer items-center px-3 py-2 pl-10 text-left text-meta text-ink-900 transition-colors hover:bg-bone-100 disabled:opacity-60"
                            >
                                {GAMES[gameType].label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
