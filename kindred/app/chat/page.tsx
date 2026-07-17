"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { ChannelFilters, ChannelOptions, ChannelSort } from "stream-chat";
import {
  Chat,
  Channel,
  ChannelHeader,
  ChannelList,
  MessageComposer,
  MessageList,
  Thread,
  Window,
  useCreateChatClient,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import { createClient } from "@/utils/supabase/client";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <StatusCard message="Loading..." />;
  }

  if (!user) {
    return (
      <StatusCard message="You need to be logged in to chat.">
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-[#153D74] px-6 py-3 font-medium text-white shadow-md transition hover:shadow-lg"
        >
          Log in
        </Link>
      </StatusCard>
    );
  }

  return <ChatWindow userId={user.id} />;
}

function StatusCard({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center font-[var(--font-poppins)]">
      <div className="w-full rounded-lg border border-[#3F79AF] bg-white p-6 shadow-sm">
        <p className="text-[#1A1A1A]">{message}</p>
        {children}
      </div>
    </main>
  );
}

function ChatWindow({ userId }: { userId: string }) {
  const client = useCreateChatClient({
    apiKey,
    tokenOrProvider: async () => {
      const res = await fetch("/api/stream-token");
      if (!res.ok) {
        throw new Error("Failed to fetch Stream token");
      }
      const data = await res.json();
      return data.token as string;
    },
    userData: { id: userId },
  });

  if (!client) {
    return <StatusCard message="Connecting to chat..." />;
  }

  const filters: ChannelFilters = { type: "messaging", members: { $in: [userId] } };
  const sort: ChannelSort = { last_message_at: -1 };
  const options: ChannelOptions = { limit: 10 };

  return (
    <div className="flex h-dvh flex-col font-[var(--font-poppins)]">
      <header className="border-b border-[#3F79AF] bg-white px-6 py-4">
        <h1 className="font-[var(--font-lora)] text-xl font-bold text-[#153D74]">Chats</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Chat client={client} theme="str-chat__theme-light">
          <ChannelList filters={filters} sort={sort} options={options} />
          <Channel>
            <Window>
              <ChannelHeader />
              <MessageList />
              <MessageComposer />
            </Window>
            <Thread />
          </Channel>
        </Chat>
      </div>
    </div>
  );
}
