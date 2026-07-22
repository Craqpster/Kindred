import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/dal";
import { endGameSession, getGameSession, saveGameState } from "@/lib/games";

// Persists a move's resulting state. No server-side rule validation in v1 - the caller
// (useGameSync.ts) already ran the game's own playMove() locally and sends the result;
// this route trusts it the same way /api/confidence and /api/chat-prompts trust their
// callers. Fine for two people playing together, not anti-cheat-hardened.
//
// Every game's state shape carries a `winner` field with the same meaning (null while
// in progress, otherwise the winning side or "draw"), so this can end the session
// generically without knowing which game it is.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const user = await getAuthUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { sessionId } = await params;
    const { state } = await request.json();

    if (!state || typeof state !== "object") {
        return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }

    // getGameSession also lazily expires an inactive game (lib/games.ts) - this is the
    // read that would catch a move arriving just after the timeout passed, so a move
    // can never land in a session that's actually already over.
    const existing = await getGameSession(sessionId);
    if (!existing) {
        return NextResponse.json({ error: "No such game session" }, { status: 404 });
    }
    if (existing.status !== "in_progress") {
        return NextResponse.json(
            { error: "This game has already ended", session: existing },
            { status: 409 },
        );
    }

    let session = await saveGameState(sessionId, state);

    if ("winner" in state && state.winner) {
        session = await endGameSession(sessionId, "completed");
    }

    return NextResponse.json({ session });
}
