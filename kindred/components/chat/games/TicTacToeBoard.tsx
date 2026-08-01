"use client";

import type { TicTacToeState } from "@/components/chat/games/tic-tac-toe";

/// Three by three. A square is a button when it can be played and a plain cell when it
/// cannot, so the keyboard only ever lands on somewhere a move is legal.
export default function TicTacToeBoard({
    state,
    yourTurn,
    onMove,
}: {
    state: TicTacToeState;
    yourTurn: boolean;
    onMove: (square: number) => void;
}) {
    return (
        <div
            className="grid grid-cols-3 gap-1.5"
            role="grid"
            aria-label="Tic-Tac-Toe board"
        >
            {state.board.map((cell, index) => {
                const playable = yourTurn && !cell && !state.winner;

                return (
                    <button
                        key={index}
                        type="button"
                        disabled={!playable}
                        onClick={() => onMove(index)}
                        aria-label={cell ? `${cell}, square ${index + 1}` : `Empty square ${index + 1}`}
                        className={`flex aspect-square items-center justify-center rounded-xl text-2xl font-semibold transition-colors ${
                            cell === "X" ? "text-accent-600" : "text-ink-900"
                        } ${
                            playable
                                ? "cursor-pointer bg-bone-100 hover:bg-bone-200"
                                : "bg-bone-100"
                        }`}
                    >
                        {cell}
                    </button>
                );
            })}
        </div>
    );
}
