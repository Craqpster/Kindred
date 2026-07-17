import { StreamChat } from "stream-chat"
import { NextResponse } from "next/server";
import { getAuthUser, getProfile } from "@/lib/dal";

const api_key = process.env.NEXT_PUBLIC_STREAM_API_KEY
const api_secret = process.env.STREAM_SECRET

if (!api_key || !api_secret) {
  throw new Error("Missing STREAM env vars");
}

const serverClient = StreamChat.getInstance(api_key, api_secret);

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const profile = await getProfile();
  const displayName = profile?.username ?? user.id;

  await serverClient.upsertUser({ id: user.id, name: displayName });

  const token = serverClient.createToken(user.id);

  return NextResponse.json({ token, userId: user.id, username: displayName });
}