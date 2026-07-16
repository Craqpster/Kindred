import { StreamChat } from "stream-chat"
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const api_key = process.env.NEXT_PUBLIC_STREAM_API_KEY
const api_secret = process.env.STREAM_SECRET

if (!api_key || !api_secret) {
  throw new Error("Missing STREAM env vars");
}

const serverClient = StreamChat.getInstance(api_key, api_secret);

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = serverClient.createToken(user.id);

  return NextResponse.json({ token, userId: user.id });
}