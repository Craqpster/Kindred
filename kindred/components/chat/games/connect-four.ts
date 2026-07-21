export type ConnectFourCell = null | 1 | 2;

export type ConnectFourState = {
    /// board[row][col], row 0 is the top. A dropped piece lands in the highest row index
    /// (bottom) that is still empty in its column.
    board: ConnectFourCell[][];
    currentPlayer: 1 | 2;
    winner: null | 1 | 2 | "draw";
};

const ROWS = 6;
const COLS = 7;

export function initialState(): ConnectFourState {
    return {
        board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
        currentPlayer: 1,
        winner: null,
    };
}

const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
];

export function checkWinner(board: ConnectFourCell[][]): ConnectFourState["winner"] {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = board[row][col];
            if (!cell) continue;

            for (const [dRow, dCol] of DIRECTIONS) {
                let count = 1;
                for (let step = 1; step < 4; step++) {
                    const r = row + dRow * step;
                    const c = col + dCol * step;
                    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== cell) break;
                    count++;
                }
                if (count === 4) return cell;
            }
        }
    }

    return board.every((row) => row.every((cell) => cell !== null)) ? "draw" : null;
}

/// A move is "which column", not "which cell" - the piece drops to the lowest open row.
/// Ignores an illegal move (column full, or the game already has a winner), same
/// no-server-validation tradeoff as tic-tac-toe.ts.
export function playMove(state: ConnectFourState, column: number): ConnectFourState {
    if (state.winner) return state;

    const board = state.board.map((row) => [...row]);
    let targetRow = -1;
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row][column] === null) {
            targetRow = row;
            break;
        }
    }
    if (targetRow === -1) return state;

    board[targetRow][column] = state.currentPlayer;

    return {
        board,
        currentPlayer: state.currentPlayer === 1 ? 2 : 1,
        winner: checkWinner(board),
    };
}
