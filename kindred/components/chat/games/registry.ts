// The two games, behind one shape.
//
// Both happen to be "a board, whose turn it is, and whether anyone has won", and both take a
// single number for a move — a square index or a column. That is enough of a common shape to
// let the server run a move without knowing which game it is, which is the whole point: the
// move is validated by the same pure function the board draws with.
//
// No "use server" and no "use client". This is imported by both, deliberately — a game whose
// rules exist twice is a game with two sets of rules.

import * as connectFour from "@/components/chat/games/connect-four";
import * as ticTacToe from "@/components/chat/games/tic-tac-toe";

/// Mirrors the game_sessions_game_type_check constraint. A new game means updating this list
/// and the migration together.
export const GAME_TYPES = ["tic-tac-toe", "connect-four"] as const;
export type GameType = (typeof GAME_TYPES)[number];

export function isGameType(value: unknown): value is GameType {
    return typeof value === "string" && (GAME_TYPES as readonly string[]).includes(value);
}

/// What any game state has in common. Each game's own state is richer — the board differs —
/// but this is all the shared code needs to reason about.
export type GameState = {
    winner: unknown;
};

type GameDefinition = {
    label: string;
    initialState: () => GameState;
    /// Applies a move, or returns the state untouched if it was illegal. Both games ignore
    /// an illegal move rather than throwing, which is what makes a stale click from a race a
    /// no-op instead of a corrupted board.
    playMove: (state: never, move: number) => GameState;
    /// How many moves the game accepts, so the server can reject an index out of range
    /// before it reaches the rules.
    moveCount: number;
};

export const GAMES: Record<GameType, GameDefinition> = {
    "tic-tac-toe": {
        label: "Tic-Tac-Toe",
        initialState: ticTacToe.initialState,
        playMove: ticTacToe.playMove as GameDefinition["playMove"],
        moveCount: 9,
    },
    "connect-four": {
        label: "Connect Four",
        initialState: connectFour.initialState,
        playMove: connectFour.playMove as GameDefinition["playMove"],
        moveCount: 7,
    },
};

/// Whether a game is over. `winner` is each game's own symbol — "X"/"O" or 1/2 — plus "draw",
/// so this only asks whether it is set rather than what it says.
export function isFinished(state: GameState): boolean {
    return state.winner !== null && state.winner !== undefined;
}
