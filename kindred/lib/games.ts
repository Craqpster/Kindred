import "server-only";

import { initialState as connectFourInitialState } from "@/components/chat/games/connect-four";
import { initialState as ticTacToeInitialState } from "@/components/chat/games/tic-tac-toe";
import type { game_sessions } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/// Mirrors the game_sessions_game_type_check constraint in the migration - the one place
/// both sides of that constraint have to agree, so a new game means updating exactly
/// this list and adding the matching migration, nothing else.
export const GAME_TYPES = ["tic-tac-toe", "connect-four"] as const;
export type GameType = (typeof GAME_TYPES)[number];

/// Shared by both routes that can create a session (immediate 1:1 start, and a group
/// invite's first join) - one place to add a new game's starting state.
export function initialStateFor(gameType: GameType) {
    return gameType === "tic-tac-toe" ? ticTacToeInitialState() : connectFourInitialState();
}

/// Starts a new game session. The DB enforces at most one in_progress session per PAIR
/// per channel (see the partial unique index in the migration) - two different pairs in
/// the same group chat can each be mid-game at once, but the same two people can't
/// double-book. inviteMessageId, when set, is what makes joining a group's game_invite
/// message atomic: it's a plain unique column, so two people racing to join the same
/// invite are really racing to insert the same value here, and only one create() wins.
export async function createGameSession(
    channelCid: string,
    gameType: string,
    playerOneId: string,
    playerTwoId: string,
    initialState: unknown,
    inviteMessageId?: string,
) {
    return prisma.game_sessions.create({
        data: {
            channel_cid: channelCid,
            game_type: gameType,
            player_one_id: playerOneId,
            player_two_id: playerTwoId,
            state: initialState as object,
            invite_message_id: inviteMessageId,
        },
    });
}

/// How long a game can sit with no move before it's treated as abandoned. Lazy, not a
/// cron job - this app has no background worker, so staleness is only ever discovered
/// (and only then written) the next time someone reads the session. In practice that's
/// often: GameControllerBar re-checks every time either player opens the chat.
const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/// If an in_progress session hasn't been touched in INACTIVITY_TIMEOUT_MS, marks it
/// abandoned and returns the updated row; otherwise returns it unchanged. Called from
/// every read path below so a stalled game can't block its pair's one-active-game slot
/// forever (the partial unique index only counts status = 'in_progress'), and so
/// whoever opens it next sees why it stopped instead of a frozen, unexplained board.
async function expireIfStale(session: game_sessions): Promise<game_sessions> {
    if (session.status !== "in_progress") return session;
    if (Date.now() - session.updated_at.getTime() < INACTIVITY_TIMEOUT_MS) return session;

    return prisma.game_sessions.update({
        where: { id: session.id },
        data: { status: "abandoned" },
    });
}

/// Loads a single session by id - what a client uses to catch up on refresh/rejoin.
export async function getGameSession(sessionId: string) {
    const session = await prisma.game_sessions.findUnique({ where: { id: sessionId } });
    return session ? expireIfStale(session) : null;
}

/// This user's in_progress session(s) in a channel, most recently updated first -
/// what GameControllerBar checks to decide between "start a game" and "resume mine".
/// Normally zero or one, but nothing stops the same person playing two different
/// partners in the same group at once, so this is a list, not a single lookup.
export async function getMyActiveGameSessions(channelCid: string, userId: string) {
    const sessions = await prisma.game_sessions.findMany({
        where: {
            channel_cid: channelCid,
            status: "in_progress",
            OR: [{ player_one_id: userId }, { player_two_id: userId }],
        },
        orderBy: { updated_at: "desc" },
    });

    const checked = await Promise.all(sessions.map(expireIfStale));
    return checked.filter((session) => session.status === "in_progress");
}

/// Persists a move. Called on every move, not just the winning one - state is the
/// source of truth a refreshed tab reads from, so it has to stay current the whole game.
export async function saveGameState(sessionId: string, state: unknown) {
    return prisma.game_sessions.update({
        where: { id: sessionId },
        data: { state: state as object },
    });
}

/// Marks a session over - a win/draw the per-game logic detected, or someone abandoning
/// mid-game. Separate from saveGameState since the final state was already saved by the
/// move that produced it; this only flips status.
export async function endGameSession(sessionId: string, status: "completed" | "abandoned") {
    return prisma.game_sessions.update({
        where: { id: sessionId },
        data: { status },
    });
}

/// Whether this user has ever been player_one_id on a game - the "Game Starter" badge.
/// player_one is always whoever initiated (the immediate 1:1 starter, or a group
/// invite's poster - see /api/games and /api/games/join), so this is a plain existence
/// check: an abandoned or still-in-progress game counts the same as a completed one,
/// since starting is the thing being recognized, not finishing.
export async function hasStartedAGame(userId: string): Promise<boolean> {
    const count = await prisma.game_sessions.count({ where: { player_one_id: userId } });
    return count > 0;
}

/// Whether this user has ever won a completed game - the "Game Winner" badge.
/// state.winner is each game's own symbol for "player one" ("X" in tic-tac-toe, 1 in
/// connect four) or "player two" ("O" / 2), not a profile id, so this fetches completed
/// games the user played in and checks state.winner against whichever side they were
/// on, rather than trying to express that mapping as a single JSON-path DB filter.
export async function hasWonAGame(userId: string): Promise<boolean> {
    const completedGames = await prisma.game_sessions.findMany({
        where: {
            status: "completed",
            OR: [{ player_one_id: userId }, { player_two_id: userId }],
        },
        select: { player_one_id: true, state: true },
    });

    return completedGames.some((game) => {
        const winner = (game.state as { winner?: unknown })?.winner;
        const wasPlayerOne = game.player_one_id === userId;
        return wasPlayerOne ? winner === "X" || winner === 1 : winner === "O" || winner === 2;
    });
}
