import { NextResponse } from "next/server";
import { getAuthUser, getProfile } from "@/lib/dal";
import { streamServerClient } from "@/lib/stream";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const profile = await getProfile();
  const displayName = profile?.username ?? user.id;

  await streamServerClient.upsertUser({ id: user.id, name: displayName });

  const token = streamServerClient.createToken(user.id);

  return NextResponse.json({ token, userId: user.id, username: displayName });
}