import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/dal";
import { getCooldownUntil, recordFlaggedAttempt } from "@/lib/moderation-rate-limit";
import { containsBlockedWord } from "@/lib/word-filter";

// Two layers: a local word list (instant, free, catches most profanity/slurs) runs
// first, and OpenAI's Moderation endpoint (catches nuance a word list can't - threats,
// self-harm language, harassment without slurs) only runs for whatever passes layer 1.
// Means the common case never touches the OpenAI API at all.
//
// If the OpenAI call itself fails (rate limit, network issue, outage), we fail open -
// the message is allowed through rather than breaking chat entirely over a moderation
// hiccup.
export async function POST(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { text } = await request.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ flagged: false });
  }

  // Already serving a cooldown from an earlier flagged message - block everything
  // (even a clean message) until it expires, without spending a check on it.
  const existingCooldown = getCooldownUntil(user.id);
  if (existingCooldown) {
    return NextResponse.json({ flagged: true, cooldownUntil: existingCooldown });
  }

  if (containsBlockedWord(text)) {
    const cooldownUntil = recordFlaggedAttempt(user.id);
    return NextResponse.json({ flagged: true, cooldownUntil });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });

    if (!res.ok) {
      return NextResponse.json({ flagged: false });
    }

    const data = await res.json();
    const flagged = data.results?.[0]?.flagged ?? false;

    if (flagged) {
      const cooldownUntil = recordFlaggedAttempt(user.id);
      return NextResponse.json({ flagged, cooldownUntil });
    }

    return NextResponse.json({ flagged: false });
  } catch {
    return NextResponse.json({ flagged: false });
  }
}
