"use client";

import { Gamepad2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
    joinGame,
    loadGame,
    loadGameByInvite,
    playGameMove,
    type GameSessionView,
} from "@/app/(app)/chats/game-actions";
import ConnectFourBoard from "@/components/chat/games/ConnectFourBoard";
import TicTacToeBoard from "@/components/chat/games/TicTacToeBoard";
import { GAMES, isGameType } from "@/components/chat/games/registry";
import type { ConnectFourState } from "@/components/chat/games/connect-four";
import type { TicTacToeState } from "@/components/chat/games/tic-tac-toe";
import { useChannel } from "@/components/chat/useConversationChannel";

/// A game_invite message: an invitation until somebody takes it, then the board itself.
///
/// The board lives in the card rather than in a modal. A game here is a thing two people are
/// doing inside a conversation, not an app they leave the conversation to open — and keeping
/// it in the timeline means the messages either side of it stay visible while you play.
export default function GameInviteCard({
    messageId,
    gameType,
    senderId,
    senderName,
    userId,
}: {
    messageId: string;
    gameType: string;
    /// Who posted the invite. They are player one and they move first.
    senderId: string | null;
    senderName: string;
    userId: string;
}) {
    const { reportMove, onMove } = useChannel();
    const [session, setSession] = useState<GameSessionView | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        if (!session) return;
        const result = await loadGame(session.id);
        if (result.ok) setSession(result.session);
    }, [session]);

    // The other player moved. The move is already saved by then, so this is a nudge to re-read
    // rather than the move itself — a dropped broadcast leaves the board stale until its next
    // load, never wrong.
    useEffect(() => {
        return onMove((sessionId) => {
            if (sessionId === session?.id) void refresh();
        });
    }, [onMove, session?.id, refresh]);

    // A game may already be under way — started from another tab, or before a reload. This is
    // the read-only lookup on purpose: asking whether a game exists must not start one, which
    // is why joinGame is reached only from the button.
    useEffect(() => {
        let cancelled = false;

        void loadGameByInvite(messageId).then((result) => {
            if (!cancelled && result.ok) setSession(result.session);
        });

        return () => {
            cancelled = true;
        };
    }, [messageId]);

    if (!isGameType(gameType)) return null;

    const game = GAMES[gameType];
    const isMine = senderId === userId;

    const join = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const result = await joinGame(messageId);
            if (result.ok) setSession(result.session);
        } finally {
            setBusy(false);
        }
    };

    const move = async (index: number) => {
        if (!session || busy) return;
        setBusy(true);
        try {
            const result = await playGameMove({ sessionId: session.id, move: index });
            if (result.ok) {
                setSession(result.session);
                reportMove(session.id);
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <li className="my-3 flex justify-center">
            <div className="w-full max-w-sm rounded-card border border-bone-300 bg-surface p-4 shadow-card">
                <p className="flex items-center gap-1.5 text-label uppercase text-ink-600">
                    <Gamepad2 size={13} strokeWidth={1.5} aria-hidden />
                    {game.label}
                </p>

                {!session ? (
                    <>
                        <p className="mt-1.5 text-body font-medium text-ink-900">
                            {isMine ? "Waiting for someone to join" : `${senderName} wants to play`}
                        </p>

                        {/* The poster gets no button. Both players come from the invite — one
                            posted it, one takes it — so joining your own would be playing
                            yourself, and the server refuses it anyway. */}
                        {!isMine && (
                            <button
                                type="button"
                                onClick={join}
                                disabled={busy}
                                className="mt-3 rounded-full bg-accent-600 px-4 py-1.5 text-label font-medium text-surface transition-colors hover:bg-accent-700 disabled:opacity-60"
                            >
                                {busy ? "Joining…" : "Join game"}
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <p className="mt-1.5 mb-3 text-meta text-ink-600">
                            {statusLine(session, userId)}
                        </p>

                        {gameType === "tic-tac-toe" ? (
                            <TicTacToeBoard
                                state={session.state as TicTacToeState}
                                yourTurn={session.yourTurn && !busy}
                                onMove={move}
                            />
                        ) : (
                            <ConnectFourBoard
                                state={session.state as ConnectFourState}
                                yourTurn={session.yourTurn && !busy}
                                onMove={move}
                            />
                        )}
                    </>
                )}
            </div>
        </li>
    );
}

/// Whose turn it is, or how it ended.
///
/// Each game names its players in its own vocabulary — "X"/"O" and 1/2 — and both put player
/// one first. That one fact is enough to turn a winner into a profile id, and a profile id
/// into "You won" rather than a symbol the reader has to decode.
function statusLine(session: GameSessionView, userId: string): string {
    const winner = (session.state as { winner?: unknown }).winner;

    if (winner === "draw") return "A draw.";

    if (winner !== null && winner !== undefined) {
        const winnerId =
            winner === "X" || winner === 1 ? session.playerOneId : session.playerTwoId;
        return winnerId === userId ? "You won." : "You lost.";
    }

    if (session.status !== "in_progress") return "This game was abandoned.";

    return session.yourTurn ? "Your turn." : "Their turn.";
}
