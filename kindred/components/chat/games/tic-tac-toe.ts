export type TicTacToeState = {
    board: (null | "X" | "O")[];
    currentPlayer: "X" | "O";
    winner: null | "X" | "O" | "draw";
};

const WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

export function initialState(): TicTacToeState {
    return { board: Array(9).fill(null), currentPlayer: "X", winner: null };
}

export function checkWinner(board: TicTacToeState["board"]): TicTacToeState["winner"] {
    for (const [a, b, c] of WIN_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return board.every((cell) => cell !== null) ? "draw" : null;
}

/// Ignores an illegal move (square taken, or the game already has a winner) rather than
/// throwing - there is no server-side validation in v1 (see useGameSync's known tradeoff),
/// so a stale click from a race just becomes a no-op instead of corrupting the board.
export function playMove(state: TicTacToeState, squareIndex: number): TicTacToeState {
    if (state.winner || state.board[squareIndex] !== null) return state;

    const board = [...state.board];
    board[squareIndex] = state.currentPlayer;

    return {
        board,
        currentPlayer: state.currentPlayer === "X" ? "O" : "X",
        winner: checkWinner(board),
    };
}
