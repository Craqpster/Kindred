"use client";

import { Gamepad2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useChannelStateContext } from "stream-chat-react";

import type { GameSession } from "@/components/chat/games/GameDefinition";
import GameModal from "@/components/chat/games/GameModal";
import { GAMES } from "@/components/chat/games/registry";

/// Lives inside <Channel> as a sibling of <ChannelHeader />, same placement constraint
/// as ModeratedMessageComposer in ChatClient.tsx - useChannelStateContext() only works
/// as a <Channel> descendant.
///
/// No active game -> the button opens a small "choose a game" list. Active game -> it
/// opens GameModal directly. Closing the modal re-checks for an active session, which is
/// what notices a just-finished game and resets the button back to "choose a game".
///
/// A 1:1 channel starts immediately - the other member is unambiguously the opponent. A
/// group instead posts a game_invite chat message (GameInviteCard.tsx renders it) -
/// whoever taps Join first becomes the opponent, first-come-first-served like a
/// GamePigeon invite. That keeps "who do I even pick" out of this bar for groups.
export default function GameControllerBar() {
    const { channel } = useChannelStateContext();
    const isGroup = channel.type === "team";

    const [activeSession, setActiveSession] = useState<GameSession | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [choosing, setChoosing] = useState(false);
    const [starting, setStarting] = useState(false);

    const refetchActive = useCallback(() => {
        fetch(`/api/games?channelCid=${encodeURIComponent(channel.cid)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setActiveSession(data?.session ?? null))
            .catch(() => {});
    }, [channel]);

    useEffect(refetchActive, [refetchActive]);

    const handleButtonClick = () => {
        if (activeSession) {
            setModalOpen(true);
        } else {
            setChoosing((prev) => !prev);
        }
    };

    const handleSelectGameType = async (gameType: string) => {
        const game = GAMES[gameType as keyof typeof GAMES];
        setStarting(true);
        try {
            if (isGroup) {
                // No session yet - createGameSession only happens once someone joins
                // (see /api/games/join). This message IS the invite.
                await channel.sendMessage({
                    text: `🎮 Started a game of ${game.label} - tap to join!`,
                    messageType: "game_invite",
                    gameType,
                });
                setChoosing(false);
            } else {
                const res = await fetch("/api/games", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ channelCid: channel.cid, gameType }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setActiveSession(data.session);
                    setChoosing(false);
                    setModalOpen(true);
                }
            }
        } finally {
            setStarting(false);
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        refetchActive();
    };

    return (
        <div className="relative border-b border-bone-300 bg-surface px-4 py-1.5">
            <button
                type="button"
                onClick={handleButtonClick}
                title="Play a game"
                className="flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:text-ink-900"
            >
                <Gamepad2 size={14} aria-hidden />
                {activeSession
                    ? `Resume ${
                        GAMES[activeSession.game_type as keyof typeof GAMES]?.label ?? "game"
                    }`
                    : "Play a game"}
            </button>

            {choosing && (
                <div className="absolute left-4 top-full z-40 mt-1 w-44 rounded-lg border border-bone-300 bg-surface py-1 shadow-card">
                    {Object.values(GAMES).map((game) => (
                        <button
                            key={game.id}
                            type="button"
                            disabled={starting}
                            onClick={() => handleSelectGameType(game.id)}
                            className="block w-full px-3 py-1.5 text-left text-sm text-ink-900 hover:bg-bone-100 disabled:opacity-50"
                        >
                            {game.label}
                        </button>
                    ))}
                </div>
            )}

            {modalOpen && activeSession && (
                <GameModal session={activeSession} channel={channel} onClose={handleCloseModal} />
            )}
        </div>
    );
}
