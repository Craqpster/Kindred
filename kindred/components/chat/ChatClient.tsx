"use client";

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

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;

// Moved out of app/chat/page.tsx. The server component now guarantees the user and hands
// down the handle, so the useEffect/loading/!user dance is gone. userData carries `name`
// so Stream shows the handle instead of the bare UUID it displayed before.
export default function ChatClient({ userId, username }: { userId: string; username: string }) {
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
        userData: { id: userId, name: username },
    });

    if (!client) {
        return (
            <div className="flex flex-1 items-center justify-center p-8 text-star-sapphire">
                Connecting to chat...
            </div>
        );
    }

    const filters: ChannelFilters = { type: "messaging", members: { $in: [userId] } };
    const sort: ChannelSort = { last_message_at: -1 };
    const options: ChannelOptions = { limit: 10 };

    return (
        <div className="flex flex-1 min-h-0">
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
    );
}
