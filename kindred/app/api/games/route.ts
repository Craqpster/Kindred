import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/dal";
import { createGameSession, GAME_TYPES, getMyActiveGameSessions, initialStateFor } from "@/lib/games";
import { streamServerClient } from "@/lib/stream";

// Whether the caller has an active game in this channel - what GameControllerBar checks
// on mount to decide between "start a game" and "resume mine". Scoped to this user, not
// the whole channel: a group chat can have several other pairs' games running at once
// (see the migration's per-pair unique index), and those don't affect this button.
export async function GET(request: NextRequest) {
    const user = await getAuthUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const channelCid = request.nextUrl.searchParams.get("channelCid");
    if (!channelCid) {
        return NextResponse.json({ error: "Missing channelCid" }, { status: 400 });
    }

    const [session] = await getMyActiveGameSessions(channelCid, user.id);
    return NextResponse.json({ session: session ?? null });
}

// Starts a new game immediately - only used for a 1:1 channel, where the other member is
// unambiguously the opponent. Groups post a game_invite chat message instead
// (GameControllerBar.tsx) and the actual session is created by whoever joins it first
// (see /api/games/join), since a group has more than one possible opponent.
export async function POST(request: NextRequest) {
    const user = await getAuthUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { channelCid, gameType } = await request.json();

    if (!channelCid || !GAME_TYPES.includes(gameType)) {
        return NextResponse.json({ error: "Missing or invalid channelCid/gameType" }, { status: 400 });
    }

    // queryChannels by cid, NOT channel(type, id).query(): a DM's id is Stream's distinct
    // "!members-..." form, and channel(type, id).query() get-or-creates, which Stream
    // rejects because "!" is reserved in an id you create. Looking the existing channel up
    // by its full cid avoids the create path entirely.
    const [channel] = await streamServerClient.queryChannels({ cid: channelCid });
    if (!channel) {
        return NextResponse.json({ error: "No such channel" }, { status: 404 });
    }
    const memberIds = Object.keys(channel.state.members);

    if (memberIds.length !== 2) {
        return NextResponse.json({ error: "Games need exactly two channel members" }, { status: 400 });
    }

    const otherId = memberIds.find((id) => id !== user.id);
    if (!otherId) {
        return NextResponse.json({ error: "You are not a member of this channel" }, { status: 403 });
    }

    try {
        const session = await createGameSession(
            channelCid,
            gameType,
            user.id,
            otherId,
            initialStateFor(gameType),
        );
        return NextResponse.json({ session });
    } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err) {
            // Unique violation - the per-pair partial unique index caught you two already
            // having a game in progress together.
            if (err.code === "P2002") {
                return NextResponse.json({ error: "You already have a game in progress" }, { status: 409 });
            }
            // Foreign key violation - the other member is a Stream user with no profiles
            // row (e.g. an account that never finished onboarding), so they can't be a
            // player. Can't happen for a real DM (both members are onboarded), but return
            // a clean message instead of a 500 rather than assume it never will.
            if (err.code === "P2003") {
                return NextResponse.json(
                    { error: "That person hasn't finished setting up their profile yet" },
                    { status: 400 },
                );
            }
        }
        throw err;
    }
}
