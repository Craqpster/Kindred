import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/dal";
import { createGameSession, GAME_TYPES, initialStateFor } from "@/lib/games";
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

    // queryChannels by cid rather than channel(type, id).query() - same reason as
    // /api/games: get-or-create rejects Stream's reserved "!" in a distinct channel id.
    // Group channels use a plain uuid id so this path wasn't broken, but the lookup form
    // is correct for both.
    const [channel] = await streamServerClient.queryChannels({ cid: channelCid });
    if (!channel) {
        return NextResponse.json({ error: "No such channel" }, { status: 404 });
    }
    const memberIds = Object.keys(channel.state.members);

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
    } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err) {
            if (err.code === "P2002") {
                return NextResponse.json({ error: "Someone already joined this game" }, { status: 409 });
            }
            // The joiner or poster has no profiles row (Stream user without an onboarded
            // profile) - clean message instead of a 500.
            if (err.code === "P2003") {
                return NextResponse.json(
                    { error: "That person hasn't finished setting up their profile yet" },
                    { status: 400 },
                );
            }
        }
        throw err;
    }

    // Resolves the invite card for everyone watching the channel - message.updated
    // propagates over the same live connection the board itself uses.
    //
    // user.id, not starterId - server-side auth requires SOME acting user for a message
    // update (same requirement channel.sendEvent has), and this update is a consequence
    // of the joiner's own action, not the original poster's.
    await streamServerClient.partialUpdateMessage(
        messageId,
        { set: { gameSessionId: session.id, gameJoinerId: user.id } },
        user.id,
    );

    return NextResponse.json({ session });
}
