"use client";

import type { Channel } from "stream-chat";
import { useChatContext } from "stream-chat-react";

import { playMove, type TicTacToeState } from "@/components/chat/games/tic-tac-toe";
import { useGameSync } from "@/components/chat/games/useGameSync";

export default function TicTacToeBoard({
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
    const { state, status, sendMove } = useGameSync<TicTacToeState>(sessionId, channel);

    if (!state) return <p className="p-4 text-sm text-ink-600">Loading game…</p>;

    // A group chat can have onlookers who are neither player - they can watch the board
    // update live but never move, same as everyone already gets a read-only view via
    // GET /api/games with no membership check.
    const isPlayerOne = client.userID === playerOneId;
    const isPlayerTwo = client.userID === playerTwoId;
    const mySymbol = isPlayerOne ? "X" : "O";
    // abandoned (lib/games.ts's inactivity timeout) ends the game the same way a winner
    // does, even though state.winner itself is still null - status is the one that
    // actually says so.
    const gameOver = !!state.winner || status === "abandoned";
    const myTurn = (isPlayerOne || isPlayerTwo) && !gameOver && state.currentPlayer === mySymbol;

    console.log({
    me: client.userID,
    playerOneId,
    playerTwoId,
    mySymbol,
    currentPlayer: state.currentPlayer,
    myTurn,
    board: state.board,
});

    const handleClick = (squareIndex: number) => {
    console.log("CLICK", {
        user: client.userID,
        squareIndex,
        mySymbol,
        currentPlayer: state.currentPlayer,
    });

    if (!myTurn || state.board[squareIndex] !== null) return;

    sendMove(playMove(state, squareIndex));
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
                            ? state.winner === mySymbol
                                ? "You won!"
                                : "You lost."
                            : `${state.winner} won!`
                        : !isPlayerOne && !isPlayerTwo
                          ? "Spectating"
                          : myTurn
                            ? "Your turn"
                            : "Their turn"}
            </p>

            <div className="grid grid-cols-3 gap-1">
                {state.board.map((cell, index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => handleClick(index)}
                        disabled={!myTurn || cell !== null}
                        className="flex size-16 items-center justify-center rounded-lg border border-bone-300 bg-surface text-2xl font-semibold text-ink-900 disabled:cursor-not-allowed enabled:hover:bg-bone-200"
                    >
                        {cell}
                    </button>
                ))}
            </div>
        </div>
    );
}
