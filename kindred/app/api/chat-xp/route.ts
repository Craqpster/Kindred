import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// Reads the shared XP total for one chat. Anyone signed in can read it (it's just a
// counter, not sensitive data), but this is still auth-gated rather than public.
export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  // Today's tally comes back alongside the total so the level popover can show progress
  // toward the daily bonus. It is the CALLER's own tally, not the whole channel's - the
  // bonus needs everyone, but "how am I doing" is the only part worth putting in front of
  // one person, and it avoids reporting other members' activity to them.
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [row, activity, bonus] = await Promise.all([
    prisma.channel_xp.findUnique({
      where: { conversation_id: conversationId },
      select: { xp: true },
    }),
    prisma.daily_chat_activity.findUnique({
      where: {
        conversation_id_profile_id_day: {
          conversation_id: conversationId,
          profile_id: user.id,
          day,
        },
      },
      select: { qualifying_messages: true },
    }),
    prisma.daily_bonus_awards.findUnique({
      where: { conversation_id_day: { conversation_id: conversationId, day } },
      select: { xp_awarded: true },
    }),
  ]);

  return NextResponse.json({
    xp: row?.xp ?? 0,
    messagesToday: activity?.qualifying_messages ?? 0,
    bonusEarnedToday: !!bonus,
  });
}
