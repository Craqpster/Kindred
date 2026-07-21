"use client";

import type { Channel } from "stream-chat";
import { useChatContext } from "stream-chat-react";

import { playMove, type ConnectFourState } from "@/components/chat/games/connect-four";
import { useGameSync } from "@/components/chat/games/useGameSync";

const PLAYER_COLOR: Record<1 | 2, string> = {
    1: "bg-accent-600",
    2: "bg-star-sapphire",
};

export default function ConnectFourBoard({
    sessionId,
    playerOneId,
    playerTwoId,
    channel,
}: {
    sessionId: string;
    playerOneId: string;
    playerTwoId: string;
    channel: Channel;
}) {
    const { client } = useChatContext();
    const { state, status, sendMove } = useGameSync<ConnectFourState>(sessionId, channel);

    if (!state) return <p className="p-4 text-sm text-ink-600">Loading game…</p>;

    // A group chat can have onlookers who are neither player - they can watch the board
    // update live but never move, same as everyone already gets a read-only view via
    // GET /api/games with no membership check.
    const isPlayerOne = client.userID === playerOneId;
    const isPlayerTwo = client.userID === playerTwoId;
    const mySide: 1 | 2 = isPlayerOne ? 1 : 2;
    // abandoned (lib/games.ts's inactivity timeout) ends the game the same way a winner
    // does, even though state.winner itself is still null - status is the one that
    // actually says so.
    const gameOver = !!state.winner || status === "abandoned";
    const myTurn = (isPlayerOne || isPlayerTwo) && !gameOver && state.currentPlayer === mySide;

    const handleColumnClick = (column: number) => {
        if (!myTurn || state.board[0][column] !== null) return;
        sendMove(playMove(state, column));
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4">
            <p className="text-sm font-medium text-ink-900">
                {status === "abandoned" && !state.winner
                    ? "This game ended due to inactivity."
                    : state.winner === "draw"
                      ? "It's a draw!"
                      : state.winner
                        ? isPlayerOne || isPlayerTwo
                            ? state.winner === mySide
                                ? "You won!"
                                : "You lost."
                            : `Player ${state.winner} won!`
                        : !isPlayerOne && !isPlayerTwo
                          ? "Spectating"
                          : myTurn
                            ? "Your turn"
                            : "Their turn"}
            </p>

            <div className="flex flex-col gap-1 rounded-lg bg-bone-200 p-2">
                {state.board.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-1">
                        {row.map((cell, colIndex) => (
                            <button
                                key={colIndex}
                                type="button"
                                onClick={() => handleColumnClick(colIndex)}
                                disabled={!myTurn || state.board[0][colIndex] !== null}
                                className="flex size-9 items-center justify-center rounded-full disabled:cursor-not-allowed"
                            >
                                <span
                                    className={`size-7 rounded-full ${cell ? PLAYER_COLOR[cell] : "bg-surface"}`}
                                />
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
