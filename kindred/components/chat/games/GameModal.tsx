"use client";

import { X } from "lucide-react";
import type { Channel } from "stream-chat";

import type { GameSession } from "@/components/chat/games/GameDefinition";
import { GAMES } from "@/components/chat/games/registry";

/// Looks up the right Board for session.game_type in GAMES and renders it - no
/// conditional per game here, the registry is the lookup.
export default function GameModal({
    session,
    channel,
    onClose,
}: {
    session: GameSession;
    channel: Channel;
    onClose: () => void;
}) {
    const game = GAMES[session.game_type as keyof typeof GAMES];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40">
            <div className="relative rounded-card bg-surface shadow-hero">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-ink-600 hover:bg-bone-200"
                >
                    <X size={16} aria-hidden />
                </button>

                <h2 className="pt-4 text-center text-sm font-semibold text-ink-900">
                    {game?.label ?? session.game_type}
                </h2>

                {game ? (
                    <game.Board
                        sessionId={session.id}
                        playerOneId={session.player_one_id}
                        playerTwoId={session.player_two_id}
                        channel={channel}
                    />
                ) : (
                    <p className="p-4 text-sm text-ink-600">Unknown game type.</p>
                )}
            </div>
        </div>
    );
}
