import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/dal";
import { awardConfidenceForMessage } from "@/lib/confidence";

// Called after a message has already been sent successfully - this is a background
// signal, not a gate on sending. Failures here are swallowed rather than surfaced,
// since the message itself already went through by the time this runs.
export async function POST(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelCid, messageId, text, isPromptResponse } = await request.json();

  if (!channelCid || !messageId || typeof text !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    await awardConfidenceForMessage(user.id, channelCid, messageId, text, !!isPromptResponse);
  } catch {
    // Best-effort - never surface this to the sender.
  }

  return NextResponse.json({ ok: true });
}
