import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/dal";
import { createGameSession, GAME_TYPES, initialStateFor } from "@/lib/games";
import { prisma } from "@/lib/prisma";
import { streamServerClient } from "@/lib/stream";

// Claims an open game_invite message (GameControllerBar.tsx posts it, GameInviteCard.tsx
// renders it) in a group chat - first join wins, same as a GamePigeon invite. The
// invite's poster becomes player_one, whoever calls this becomes player_two.
//
// "First join wins" is decided by invite_message_id's plain unique constraint, not the
// per-pair one: two people racing to join THIS message are really racing to insert the
// same invite_message_id, and only one create() can win that regardless of who each of
// them would be paired with. The per-pair constraint is a separate, independent guard -
// it only kicks in if this exact pair already has another game going.
export async function POST(request: NextRequest) {
    const user = await getAuthUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { channelCid, gameType, starterId, messageId } = await request.json();

    if (!channelCid || !GAME_TYPES.includes(gameType) || !starterId || !messageId) {
        return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }
    if (starterId === user.id) {
        return NextResponse.json({ error: "You can't join your own game" }, { status: 400 });
    }

    const [channelType, channelId] = channelCid.split(":");
    const channel = streamServerClient.channel(channelType, channelId);
    const { members } = await channel.query();
    const memberIds = members.map((member) => member.user_id).filter((id): id is string => !!id);

    if (!memberIds.includes(user.id) || !memberIds.includes(starterId)) {
        return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
    }

    let session;
    try {
        session = await createGameSession(
            channelCid,
            gameType,
            starterId,
            user.id,
            initialStateFor(gameType),
            messageId,
        );
    } catch (err) {
        console.error("[games/join] createGameSession failed", err);
        return NextResponse.json({ error: "Couldn't create game session" }, { status: 409 });
    }

    try {
        const result = await streamServerClient.partialUpdateMessage(
            messageId,
            {
                set: {
                    gameSessionId: session.id,
                    gameJoinerId: user.id,
                },
            },
            starterId,
        );

    } catch (err) {
        // Roll back the DB row so this invite isn't permanently poisoned by the
        // invite_message_id unique constraint — otherwise every retry 409s forever.
        console.error("[games/join] partialUpdateMessage FAILED, rolling back session", err);
        await prisma.game_sessions.delete({ where: { id: session.id } }).catch((cleanupErr) => {
            console.error("[games/join] rollback delete also failed", cleanupErr);
        });
        return NextResponse.json({ error: "Failed to update invite message" }, { status: 500 });
    }

    return NextResponse.json({
        session,
        gameSessionId: session.id,
        gameJoinerId: user.id,
    });
}