import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/dal";
import { postIcebreakerPrompt } from "@/lib/prompts";

// Posts a fresh icebreaker prompt into a channel - used by the on-demand button and by
// the client-side "this chat has gone quiet" check in ChatClient.tsx. Auth-gated but
// not membership-checked, matching /api/confidence and /api/chat-xp's existing trust
// model for chat-scoped actions in this app.
export async function POST(request: NextRequest) {
    const user = await getAuthUser();

    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { channelCid } = await request.json();

    if (!channelCid) {
        return NextResponse.json({ error: "Missing channelCid" }, { status: 400 });
    }

    await postIcebreakerPrompt(channelCid);

    return NextResponse.json({ ok: true });
}
