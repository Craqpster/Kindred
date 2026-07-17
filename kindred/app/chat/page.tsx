"use client";

import { useEffect, useState } from "react";
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
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return <div className="p-8">You need to be logged in to chat.</div>;
  }

  return <ChatWindow userId={user.id} />;
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
    return <div className="p-8">Connecting to chat...</div>;
  }

  const filters: ChannelFilters = { type: "messaging", members: { $in: [userId] } };
  const sort: ChannelSort = { last_message_at: -1 };
  const options: ChannelOptions = { limit: 10 };

  return (
    <div className="flex flex-1">
      <Chat client={client}>
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
  );
}
