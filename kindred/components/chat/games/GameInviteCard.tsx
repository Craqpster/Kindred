"use client";

import { useState } from "react";
import type { Channel, LocalMessage } from "stream-chat";
import { useChatContext } from "stream-chat-react";

import type { GameSession } from "@/components/chat/games/GameDefinition";
import GameModal from "@/components/chat/games/GameModal";
import { GAMES } from "@/components/chat/games/registry";

/// Renders a game_invite message (posted by GameControllerBar.tsx for a group chat) as a
/// GamePigeon-style card: open while nobody has joined, resolved once someone has.
/// First-come-first-served is enforced server-side by /api/games/join, not here - this
/// just reflects whatever the message currently says.
export default function GameInviteCard({
    message,
    channel,
}: {
    message: LocalMessage;
    channel: Channel;
}) {
    const { client } = useChatContext();
    const [modalOpen, setModalOpen] = useState(false);
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);

    const game = GAMES[message.gameType as keyof typeof GAMES];
    const starterId = message.user?.id;
    const starterName = message.user?.name ?? "Someone";
    const isStarter = client.userID === starterId;
    const resolved = !!message.gameSessionId;

    const handleJoin = async () => {
        if (!starterId) return;
        setJoining(true);
        setJoinError(null);
        try {
            const res = await fetch("/api/games/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelCid: channel.cid,
                    gameType: message.gameType,
                    starterId,
                    messageId: message.id,
                }),
            });
            if (res.ok) {
                setModalOpen(true);
            } else {
                const data = await res.json().catch(() => null);
                setJoinError(data?.error ?? "Couldn't join that game");
            }
        } finally {
            setJoining(false);
        }
    };

    if (!game) return null;

    const joinerName = message.gameJoinerId
        ? (channel.state.members[message.gameJoinerId]?.user?.name ?? "Someone")
        : null;

    const session: GameSession | null = resolved
        ? {
              id: message.gameSessionId!,
              game_type: message.gameType!,
              player_one_id: starterId!,
              player_two_id: message.gameJoinerId!,
          }
        : null;

    return (
        <div className="my-2 mx-auto max-w-sm rounded-2xl border border-metro-blue/20 bg-mist px-4 py-3 text-center">
            <p className="mb-1 text-xs font-medium text-metro-blue">🎮 {game.label}</p>

            {resolved ? (
                <>
                    <p className="mb-2 text-sm text-star-sapphire">
                        {starterName} vs {joinerName}
                    </p>
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="rounded-full bg-metro-blue px-3 py-1 text-xs font-medium text-white hover:bg-metro-blue/90"
                    >
                        Open game
                    </button>
                </>
            ) : isStarter ? (
                <p className="text-sm text-ink-600">Waiting for someone to join…</p>
            ) : (
                <>
                    <p className="mb-2 text-sm text-star-sapphire">{starterName} wants to play</p>
                    <button
                        type="button"
                        onClick={handleJoin}
                        disabled={joining}
                        className="rounded-full bg-metro-blue px-3 py-1 text-xs font-medium text-white hover:bg-metro-blue/90 disabled:opacity-50"
                    >
                        {joining ? "Joining…" : "Join"}
                    </button>
                    {joinError && <p className="mt-1 text-xs text-red-700">{joinError}</p>}
                </>
            )}

            {modalOpen && session && (
                <GameModal session={session} channel={channel} onClose={() => setModalOpen(false)} />
            )}
        </div>
    );
}
