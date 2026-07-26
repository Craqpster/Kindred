import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/dal";
import { getGameSession } from "@/lib/games";

// Loads one session by id - what useGameSync.ts calls on mount/refresh to catch up from
// Postgres, the source of truth a rejoining tab trusts over whatever Stream last pushed.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const user = await getAuthUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { sessionId } = await params;
    const session = await getGameSession(sessionId);

    if (!session) {
        return NextResponse.json({ error: "No such game session" }, { status: 404 });
    }

    return NextResponse.json({ session });
}