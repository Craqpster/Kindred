"use server";

import { z } from "zod";

import { GAMES, isGameType, type GameType } from "@/components/chat/games/registry";
import { isMember } from "@/lib/chat/queries";
import { sendMessage } from "@/lib/chat/mutations";
import type { ChatMessage } from "@/lib/chat/types";
import { verifySession } from "@/lib/dal";
import {
    createGameSession,
    getGameSession,
    initialStateFor,
    saveGameState,
    endGameSession,
} from "@/lib/games";
import { prisma } from "@/lib/prisma";

// Starting, joining and playing a game.
//
// Kept out of chats/actions.ts because it is a different subject, and that file is already the
// full surface of chat itself.
//
// The important difference from the version this replaces: **the client sends a move, not a
// board.** The old route took `{ state: newState }` and stored whatever arrived, so a crafted
// client could post any position — including a won one. playMove is pure and shared, so the
// server can take a square index and recompute, which makes the rules unforgeable at no cost.

const uuid = z.uuid();

export type GameSessionView = {
    id: string;
    gameType: GameType;
    playerOneId: string;
    playerTwoId: string;
    state: unknown;
    status: string;
    /// Whose turn it is, resolved to a profile id so a board never has to know that this game
    /// calls its players "X" and "O" and that one calls them 1 and 2.
    yourTurn: boolean;
};

function toView(
    session: {
        id: string;
        game_type: string;
        player_one_id: string;
        player_two_id: string;
        state: unknown;
        status: string;
    },
    userId: string,
): GameSessionView | null {
    if (!isGameType(session.game_type)) return null;

    // Both games number their players from the start of the state's own vocabulary: X moves
    // first, and player 1 moves first. So "is it mine" is "am I player one, and is it player
    // one's turn" — expressed once, here, rather than in each board.
    const current = (session.state as { currentPlayer?: unknown }).currentPlayer;
    const playerOneMoves = current === "X" || current === 1;

    return {
        id: session.id,
        gameType: session.game_type,
        playerOneId: session.player_one_id,
        playerTwoId: session.player_two_id,
        state: session.state,
        status: session.status,
        yourTurn:
            session.status === "in_progress" &&
            (playerOneMoves ? session.player_one_id === userId : session.player_two_id === userId),
    };
}

const startInput = z.object({
    conversationId: uuid,
    gameType: z.enum(["tic-tac-toe", "connect-four"]),
});

/// Posts a game invite into the conversation. Nobody is playing yet — the session is created
/// when someone joins, which is what lets a group invite be claimed by whoever answers first.
export async function startGame(input: {
    conversationId: string;
    gameType: string;
}): Promise<{ ok: true; message: ChatMessage } | { ok: false }> {
    const { userId } = await verifySession();

    const parsed = startInput.safeParse(input);
    if (!parsed.success) return { ok: false };

    const result = await sendMessage({
        conversationId: parsed.data.conversationId,
        senderId: userId,
        kind: "game_invite",
        body: `Let's play ${GAMES[parsed.data.gameType].label}`,
        gameType: parsed.data.gameType,
    });

    return result.ok ? { ok: true, message: result.message } : { ok: false };
}

/// Claims an invite and starts the session.
///
/// invite_message_id is unique, so two people tapping the same invite at the same moment are
/// racing to write the same value — exactly one insert can win. The loser reads the session
/// the winner created rather than getting an error, because from their side "someone already
/// joined" and "I joined" should both end with the board open.
export async function joinGame(
    inviteMessageId: string,
): Promise<{ ok: true; session: GameSessionView } | { ok: false }> {
    const { userId } = await verifySession();

    const parsed = uuid.safeParse(inviteMessageId);
    if (!parsed.success) return { ok: false };

    const invite = await prisma.messages.findUnique({
        where: { id: parsed.data },
        select: { conversation_id: true, sender_id: true, game_type: true, kind: true },
    });

    if (!invite || invite.kind !== "game_invite" || !isGameType(invite.game_type)) {
        return { ok: false };
    }
    if (!invite.sender_id || invite.sender_id === userId) return { ok: false };
    if (!(await isMember({ conversationId: invite.conversation_id, userId }))) {
        return { ok: false };
    }

    const existing = await prisma.game_sessions.findUnique({
        where: { invite_message_id: parsed.data },
    });

    if (existing) {
        const view = toView(existing, userId);
        return view ? { ok: true, session: view } : { ok: false };
    }

    try {
        const session = await createGameSession(
            invite.conversation_id,
            invite.game_type,
            // Whoever posted the invite moves first, which is the same order the board reads.
            invite.sender_id,
            userId,
            initialStateFor(invite.game_type),
            parsed.data,
        );

        const view = toView(session, userId);
        return view ? { ok: true, session: view } : { ok: false };
    } catch {
        // Lost the race for invite_message_id. Somebody else is in, so read theirs.
        const claimed = await prisma.game_sessions.findUnique({
            where: { invite_message_id: parsed.data },
        });
        const view = claimed ? toView(claimed, userId) : null;
        return view ? { ok: true, session: view } : { ok: false };
    }
}

/// The session claimed from an invite, if there is one. Read-only, unlike joinGame.
///
/// The two are deliberately separate. A card rendering in the timeline needs to know whether
/// a game is already under way; it must not start one by asking. Joining is something a
/// person does by pressing a button.
export async function loadGameByInvite(
    inviteMessageId: string,
): Promise<{ ok: true; session: GameSessionView } | { ok: false }> {
    const { userId } = await verifySession();

    const parsed = uuid.safeParse(inviteMessageId);
    if (!parsed.success) return { ok: false };

    const session = await prisma.game_sessions.findUnique({
        where: { invite_message_id: parsed.data },
    });

    if (!session) return { ok: false };
    if (session.player_one_id !== userId && session.player_two_id !== userId) {
        // A game between two other people in a group. Visible as an invite, not as a board.
        return { ok: false };
    }

    const view = toView(session, userId);
    return view ? { ok: true, session: view } : { ok: false };
}

/// The current state of a session, for a board opening or catching up.
export async function loadGame(
    sessionId: string,
): Promise<{ ok: true; session: GameSessionView } | { ok: false }> {
    const { userId } = await verifySession();

    const parsed = uuid.safeParse(sessionId);
    if (!parsed.success) return { ok: false };

    const session = await getGameSession(parsed.data);
    if (!session) return { ok: false };
    if (session.player_one_id !== userId && session.player_two_id !== userId) {
        return { ok: false };
    }

    const view = toView(session, userId);
    return view ? { ok: true, session: view } : { ok: false };
}

const moveInput = z.object({ sessionId: uuid, move: z.number().int().min(0).max(41) });

/// Plays one move.
///
/// Takes the move, not the resulting board. The server loads the stored state, checks it is
/// this player's turn, and runs the same playMove the board runs — so an illegal move, a move
/// out of turn, or a hand-crafted winning position all resolve to the position that actually
/// follows from the rules.
export async function playGameMove(input: {
    sessionId: string;
    move: number;
}): Promise<{ ok: true; session: GameSessionView } | { ok: false }> {
    const { userId } = await verifySession();

    const parsed = moveInput.safeParse(input);
    if (!parsed.success) return { ok: false };

    const session = await getGameSession(parsed.data.sessionId);
    if (!session || session.status !== "in_progress") return { ok: false };
    if (!isGameType(session.game_type)) return { ok: false };

    const before = toView(session, userId);
    if (!before || !before.yourTurn) return { ok: false };

    const game = GAMES[session.game_type];
    if (parsed.data.move >= game.moveCount) return { ok: false };

    const next = game.playMove(session.state as never, parsed.data.move);

    // playMove returns the state untouched when the move was illegal. Nothing to write, and
    // nothing to tell the other player about.
    if (next === session.state) return { ok: false };

    const saved = await saveGameState(session.id, next);

    if (next.winner !== null && next.winner !== undefined) {
        await endGameSession(session.id, "completed");
    }

    const view = toView({ ...saved, state: next }, userId);
    return view ? { ok: true, session: view } : { ok: false };
}
