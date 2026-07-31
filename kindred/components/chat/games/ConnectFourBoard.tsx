"use client";

import type { ConnectFourState } from "@/components/chat/games/connect-four";

/// Seven columns of six. You play a column, not a cell — the piece falls — so the whole
/// column is one control rather than six, which is both how the game works and how it wants
/// to be operated from a keyboard.
export default function ConnectFourBoard({
    state,
    yourTurn,
    onMove,
}: {
    state: ConnectFourState;
    yourTurn: boolean;
    onMove: (column: number) => void;
}) {
    const columnCount = state.board[0]?.length ?? 7;

    return (
        <div className="grid grid-cols-7 gap-1 rounded-xl bg-bone-100 p-1.5" role="grid" aria-label="Connect Four board">
            {Array.from({ length: columnCount }, (_, column) => {
                // A column is full when its top cell is taken — the piece would have nowhere
                // to land.
                const full = state.board[0]?.[column] !== null;
                const playable = yourTurn && !full && !state.winner;

                return (
                    <button
                        key={column}
                        type="button"
                        disabled={!playable}
                        onClick={() => onMove(column)}
                        aria-label={`Column ${column + 1}${full ? ", full" : ""}`}
                        className={`flex flex-col gap-1 rounded-lg p-1 transition-colors ${
                            playable ? "cursor-pointer hover:bg-bone-200" : ""
                        }`}
                    >
                        {state.board.map((row, rowIndex) => (
                            <span
                                key={rowIndex}
                                aria-hidden
                                className={`aspect-square rounded-full ${
                                    row[column] === 1
                                        ? "bg-accent-600"
                                        : row[column] === 2
                                          ? "bg-ink-600"
                                          : "bg-surface"
                                }`}
                            />
                        ))}
                    </button>
                );
            })}
        </div>
    );
}
