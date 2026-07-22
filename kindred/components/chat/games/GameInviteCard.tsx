"use client";

import { useState, useEffect, useMemo } from "react";
import { CircleDashed, Gamepad2, Hash } from "lucide-react";
import type { Channel, LocalMessage } from "stream-chat";
import { useChatContext } from "stream-chat-react";

import type { GameSession } from "@/components/chat/games/GameDefinition";
import GameModal from "@/components/chat/games/GameModal";
import { GAMES } from "@/components/chat/games/registry";

/// Renders a game_invite message (posted by GameControllerBar.tsx or AttachmentMenu) as a
/// GamePigeon-style card: open while nobody has joined, resolved once someone has.
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
    const [optimistic, setOptimistic] = useState<{ gameSessionId: string; gameJoinerId: string } | null>(null);
    const [gameResult, setGameResult] = useState<"won" | "lost" | null>(null);

    const game = GAMES[message.gameType as keyof typeof GAMES];
    const starterId = message.user?.id;
    const starterName = message.user?.name ?? "Someone";
    const isStarter = client.userID === starterId;

    // Single source of truth: server-confirmed state (message.*) wins once it arrives,
    // the optimistic values fill the gap for the joiner before the WS event lands.
    const resolvedSessionId = message.gameSessionId ?? optimistic?.gameSessionId;
    const resolvedJoinerId = message.gameJoinerId ?? optimistic?.gameJoinerId;
    const resolved = !!resolvedSessionId;

    console.log("[GameInviteCard] debug", {
        myUserId: client.userID,
        messageId: message.id,
        starterId,
        isStarter,
        rawGameSessionId: message.gameSessionId,
        rawGameJoinerId: message.gameJoinerId,
        optimistic,
        resolvedSessionId,
        resolvedJoinerId,
        resolved,
    });

    // --- TEMPORARY DEBUG PROBE — remove once confirmed fixed ---
    // Tells us whether the WS message.updated event is even reaching this client.
    useEffect(() => {
        const handler = (e: any) => {
            if (e.message?.id === message.id) {
                console.log("[GameInviteCard] WS message.updated received", {
                    myUserId: client.userID,
                    messageId: e.message.id,
                    gameSessionId: e.message.gameSessionId,
                    gameJoinerId: e.message.gameJoinerId,
                });
            }
        };
        channel.on("message.updated", handler);
        return () => channel.off("message.updated", handler);
    }, [channel, message.id, client.userID]);
    // --- END TEMPORARY DEBUG PROBE ---

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
            const data = await res.json().catch(() => null);

            console.log("[GameInviteCard] /api/games/join response", {
                status: res.status,
                ok: res.ok,
                data,
            });

            if (res.ok) {
                setOptimistic({ gameSessionId: data.gameSessionId, gameJoinerId: data.gameJoinerId });
                setModalOpen(true);
            } else {
                setJoinError(data?.error ?? "Couldn't join that game");
            }
        } finally {
            setJoining(false);
        }
    };

    if (!game) return null;

    const joinerName = resolvedJoinerId
        ? (channel.state.members[resolvedJoinerId]?.user?.name ?? "Someone")
        : null;

    const session: GameSession | null = useMemo(
        () =>
            resolved
                ? {
                    id: resolvedSessionId!,
                    game_type: message.gameType!,
                    player_one_id: starterId!,
                    player_two_id: resolvedJoinerId!,
                }
                : null,
        [resolved, resolvedSessionId, resolvedJoinerId, message.gameType, starterId],
    );

    useEffect(() => {
        if (!session) return;

        fetch(`/api/games/${session.id}`)
            .then((res) => res.json())
            .then((data) => {
                const winner = data.session?.state?.winner;

                if (!winner || winner === "draw") {
                    return;
                }

                const mySymbol =
                    client.userID === session.player_one_id ? "X" : "O";

                setGameResult(winner === mySymbol ? "won" : "lost");
            })
            .catch(() => {});
    }, [session, client.userID]);

    const SpecificGameIcon = message.gameType === "tic-tac-toe" ? Hash : CircleDashed;

    return (
        <div className="my-3 flex justify-center">
            <div className="w-full max-w-md rounded-card border border-bone-300 bg-surface p-4 shadow-card">

                <p className="flex items-center gap-1.5 text-label uppercase text-ink-600">
                    <Gamepad2 size={13} strokeWidth={1.5} aria-hidden />
                    Game Invite • {game.label}
                </p>

                <p className="mt-1.5 text-body font-medium text-ink-900">
                    {resolved ? (
                        <>{starterName} vs {joinerName}</>
                    ) : isStarter ? (
                        <>You started a game of {game.label}.</>
                    ) : (
                        <>{starterName} challenged the chat to a game!</>
                    )}
                </p>

                <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-meta text-ink-600">
                        <SpecificGameIcon size={16} strokeWidth={1.5} className="text-metro-blue" />
                        <span className="truncate">
                            {gameResult === "won"
                                ? "Victory!"
                                : gameResult === "lost"
                                ? "Defeat"
                                : resolved
                                    ? "Game in progress"
                                    : "First to join plays"}
                        </span>
                    </p>

                    <span className="flex shrink-0 items-center gap-2">
                        {resolved ? (
                            <button
                                type="button"
                                onClick={() => setModalOpen(true)}
                                className="cursor-pointer rounded-full bg-metro-blue px-4 py-1.5 text-meta font-medium text-white transition-colors hover:bg-metro-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metro-blue/40"
                            >
                                {gameResult === "won"
                                    ? "I Won 🏆"
                                    : gameResult === "lost"
                                    ? "I Lost"
                                    : "Open game"}
                            </button>
                        ) : isStarter ? (
                            <button
                                type="button"
                                disabled
                                className="cursor-not-allowed rounded-full bg-bone-200 px-4 py-1.5 text-meta font-medium text-ink-500"
                            >
                                Waiting…
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleJoin}
                                disabled={joining}
                                className="cursor-pointer rounded-full bg-metro-blue px-4 py-1.5 text-meta font-medium text-white transition-colors hover:bg-metro-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metro-blue/40 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {joining ? "Joining…" : "Join"}
                            </button>
                        )}
                    </span>
                </div>

                {joinError && (
                    <p role="alert" className="mt-3 text-meta text-red-700">
                        {joinError}
                    </p>
                )}

                {modalOpen && session && (
                    <GameModal session={session} channel={channel} onClose={() => setModalOpen(false)} />
                )}
            </div>
        </div>
    );
}