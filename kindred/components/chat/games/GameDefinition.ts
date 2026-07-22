import type { Channel } from "stream-chat";

/// The subset of a game_sessions row client components need - not the full Prisma row,
/// so client bundles never pull in generated Prisma types just for this.
export type GameSession = {
    id: string;
    game_type: string;
    player_one_id: string;
    player_two_id: string;
};

/// One entry in the game registry (registry.ts). Each game module exports one of these -
/// the registry is just a lookup from game_type to its definition, so GameModal and the
/// "start a game" chooser never need an if/switch over known game types.
export interface GameDefinition<TState = unknown> {
    id: string;
    label: string;
    initialState: () => TState;
    /// playerOneId is the profile id that goes first ("X" in tic-tac-toe, player 1 in
    /// connect four). The Board compares both ids against the local user's id (from
    /// useChatContext().client.userID) to tell player one, player two, and a spectator
    /// (a group member who is neither) apart - only the two players can move.
    Board: React.ComponentType<{
        sessionId: string;
        playerOneId: string;
        playerTwoId: string;
        channel: Channel;
    }>;
}
