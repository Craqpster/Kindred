import { revalidatePath } from "next/cache";
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

  const { channelCid, messageId, text, promptId } = await request.json();

  if (!channelCid || !messageId || typeof text !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    // promptId is only a claim at this point - awardConfidenceForMessage checks it
    // against Stream before letting it unlock the guaranteed award.
    const award = await awardConfidenceForMessage(
      user.id,
      channelCid,
      messageId,
      text,
      typeof promptId === "string" ? promptId : undefined,
    );

    // /me renders confidence_points and the tier from a server component, and nothing
    // else invalidates it - without this the profile can show a stale total until the
    // next full load, and ConfidenceCard's tier-up confetti fires whenever a render
    // happens to notice rather than when the tier was actually earned.
    if (award) revalidatePath("/me");

    // null means nothing was awarded (too short, or the same sender twice in a row).
    // The caller needs that distinction to avoid claiming XP that was never given.
    return NextResponse.json({ ok: true, award });
  } catch {
    // Best-effort - never surface this to the sender.
    return NextResponse.json({ ok: true, award: null });
  }
}
