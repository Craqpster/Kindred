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

  const channelCid = request.nextUrl.searchParams.get("channelCid");

  if (!channelCid) {
    return NextResponse.json({ error: "Missing channelCid" }, { status: 400 });
  }

  const row = await prisma.channel_xp.findUnique({
    where: { channel_cid: channelCid },
    select: { xp: true },
  });

  return NextResponse.json({ xp: row?.xp ?? 0 });
}
