// Checks the game rules the server now enforces.
//
// This matters more than it used to. The version built on Stream took the finished board from
// the client — `{ state: newState }` — and stored whatever arrived, so the rules were a
// suggestion and a crafted client could post a won position. playGameMove now takes only the
// move and recomputes with these functions, which means they are the whole of the referee.
//
// The two properties worth pinning are the ones a rewrite would quietly break: an illegal move
// must return the SAME object, because playGameMove uses identity to tell "nothing happened"
// from "something happened"; and a finished game must stop accepting moves, or a winner could
// keep playing until they were no longer winning.
//
// Needs no database and no network — the rules are pure.
//
// Run: npm run verify:games
import * as connectFour from "../components/chat/games/connect-four";
import * as ticTacToe from "../components/chat/games/tic-tac-toe";

type Check = { name: string; ok: boolean; note?: string };

const checks: Check[] = [];

function expect(name: string, actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    checks.push(a === b ? { name, ok: true } : { name, ok: false, note: `got ${a}, want ${b}` });
}

function assert(name: string, ok: boolean, note?: string) {
    checks.push({ name, ok, note });
}

// --- tic-tac-toe ----------------------------------------------------------------------

{
    const empty = ticTacToe.initialState();
    expect("tic-tac-toe starts with X", empty.currentPlayer, "X");
    expect("tic-tac-toe starts unwon", empty.winner, null);

    const afterOne = ticTacToe.playMove(empty, 0);
    expect("a move places the current player", afterOne.board[0], "X");
    expect("a move passes the turn", afterOne.currentPlayer, "O");

    // Identity, not equality: playGameMove returns { ok: false } when the state comes back
    // unchanged, so a copy would be read as a legal move that did nothing.
    assert(
        "playing a taken square returns the same object",
        ticTacToe.playMove(afterOne, 0) === afterOne,
    );

    // X across the top.
    let won = ticTacToe.initialState();
    for (const square of [0, 3, 1, 4, 2]) won = ticTacToe.playMove(won, square);
    expect("three in a row wins", won.winner, "X");

    assert(
        "a won game accepts no more moves",
        ticTacToe.playMove(won, 8) === won,
    );

    // Fill every square with no line: X O X / X O O / O X X
    let drawn = ticTacToe.initialState();
    for (const square of [0, 1, 2, 4, 3, 5, 7, 6, 8]) {
        drawn = ticTacToe.playMove(drawn, square);
    }
    expect("a full board with no line is a draw", drawn.winner, "draw");
}

// --- connect four ---------------------------------------------------------------------

{
    const empty = connectFour.initialState();
    expect("connect four starts with player one", empty.currentPlayer, 1);
    expect("connect four is six rows", empty.board.length, 6);
    expect("connect four is seven columns", empty.board[0].length, 7);

    const afterOne = connectFour.playMove(empty, 3);
    expect("a piece falls to the bottom row", afterOne.board[5][3], 1);
    expect("the row above stays empty", afterOne.board[4][3], null);
    expect("a move passes the turn", afterOne.currentPlayer, 2);

    // Player one takes column 0, player two answers in column 6, four times.
    let won = connectFour.initialState();
    for (const column of [0, 6, 1, 6, 2, 6, 3]) won = connectFour.playMove(won, column);
    expect("four in a row wins", won.winner, 1);

    assert("a won game accepts no more moves", connectFour.playMove(won, 5) === won);

    // Six pieces fill a column; the seventh has nowhere to go.
    let full = connectFour.initialState();
    for (let i = 0; i < 6; i++) full = connectFour.playMove(full, 0);
    assert("playing a full column returns the same object", connectFour.playMove(full, 0) === full);
}

// --- report ---------------------------------------------------------------------------

for (const check of checks) {
    console.log(`  ${check.ok ? "PASS" : "FAIL"}  ${check.name}${check.note ? ` — ${check.note}` : ""}`);
}

const failed = checks.filter((check) => !check.ok).length;
console.log(`\n${checks.length - failed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
