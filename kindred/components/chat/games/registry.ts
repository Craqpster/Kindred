import ConnectFourBoard from "@/components/chat/games/ConnectFourBoard";
import { initialState as connectFourInitialState } from "@/components/chat/games/connect-four";
import type { GameDefinition } from "@/components/chat/games/GameDefinition";
import TicTacToeBoard from "@/components/chat/games/TicTacToeBoard";
import { initialState as ticTacToeInitialState } from "@/components/chat/games/tic-tac-toe";
import type { GameType } from "@/lib/games";

const ticTacToeGame: GameDefinition = {
    id: "tic-tac-toe",
    label: "Tic-Tac-Toe",
    initialState: ticTacToeInitialState,
    Board: TicTacToeBoard,
};

const connectFourGame: GameDefinition = {
    id: "connect-four",
    label: "Connect Four",
    initialState: connectFourInitialState,
    Board: ConnectFourBoard,
};

/// The entire "engine" seam: GameControllerBar and GameModal look games up here instead
/// of branching on game_type themselves. A third game means adding one more entry -
/// nothing else in this directory changes.
export const GAMES: Record<GameType, GameDefinition> = {
    "tic-tac-toe": ticTacToeGame,
    "connect-four": connectFourGame,
};
