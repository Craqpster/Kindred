"use client";

import type { ChannelFilters, ChannelOptions, ChannelSort } from "stream-chat";
import { Channel, ChannelHeader, ChannelList, MessageComposer, MessageList, Thread, Window } from "stream-chat-react";

// The Stream connection itself now lives in ChatConnectionProvider, wrapping the whole
// (app) shell - by the time this renders, <Chat> is already an ancestor from the
// layout, so ChannelList/Channel pick up client + theme from context on their own.
export default function ChatClient({ userId }: { userId: string }) {
    const filters: ChannelFilters = { type: "messaging", members: { $in: [userId] } };
    const sort: ChannelSort = { last_message_at: -1 };
    const options: ChannelOptions = { limit: 10 };

    return (
        // Channel-list width is fixed via the .str-chat.str-chat__channel-list rule in
        // globals.css, not here - see that rule's comment for why an inline/ancestor
        // override doesn't work for this particular library. The flex-1 wrapper below
        // is still needed though: Stream's .str-chat__channel has no flex-grow of its
        // own, so without a wrapper that claims the remaining space, it would only be
        // as wide as its content demands.
        <div className="flex flex-1 min-h-0">
            <ChannelList filters={filters} sort={sort} options={options} />
            <div className="flex flex-1 min-w-0">
                <Channel>
                    <Window>
                        <ChannelHeader />
                        <MessageList />
                        <MessageComposer />
                    </Window>
                    <Thread />
                </Channel>
            </div>
        </div>
    );
}
