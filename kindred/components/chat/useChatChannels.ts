"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Channel, ChannelFilters, ChannelSort } from "stream-chat";
import { useChatContext, useStateStore } from "stream-chat-react";

// One query for everything the user is in, partitioned here rather than run twice. `$in` on
// `type` is supported — ChannelResponse['type'] is a string, so it takes the
// QueryFilter<string> branch — which is what lets groups ("team") and 1:1s ("messaging")
// share a list.
const SORT: ChannelSort = { last_message_at: -1 };
const OPTIONS = { limit: 20, state: true, watch: true, presence: false } as const;

export type ChatChannels = {
    /// Conversations both people are in. Groups included.
    active: Channel[];
    /// One person reached out and the other hasn't replied yet.
    pending: Channel[];
    initialized: boolean;
    hasNext: boolean;
    loadNext: () => void;
};

/// The channel list, without Stream's list UI.
///
/// Built on client.createChannelManager(), which is a headless version of what <ChannelList>
/// runs internally: the query, pagination, and the whole realtime handler set (message.new
/// reordering, notification.message_new, channel.updated, deletions, member changes). The
/// alternative — queryChannels plus our own handlers — means reimplementing about ten of
/// them, and the hook that supplies them to <ChannelList> (useChannelListShape) is not
/// exported.
///
/// The manager is annotated @internal by Stream even though it is exported from the package
/// root and their newer SDKs are built on it. If it ever goes away, the fallback is the
/// exported usePaginatedChannels plus hand-written event handlers.
export function useChatChannels(userId: string): ChatChannels {
    const { client } = useChatContext();

    const filters: ChannelFilters = useMemo(
        () => ({ type: { $in: ["messaging", "team"] }, members: { $in: [userId] } }),
        [userId],
    );

    // Created once per client. Held in state rather than a ref so the first render already
    // has a store to subscribe to — useStateStore needs a real store, not null.
    const [manager] = useState(() => client.createChannelManager({}));

    // Guards against StrictMode's double-invoked effects re-querying on mount. The
    // subscriptions themselves are ref-counted by Stream, so those are safe to pair up.
    const queried = useRef(false);

    useEffect(() => {
        manager.registerSubscriptions();
        if (!queried.current) {
            queried.current = true;
            void manager.queryChannels(filters, SORT, OPTIONS);
        }
        return () => {
            manager.unregisterSubscriptions();
        };
    }, [manager, filters]);

    const { channels, initialized, hasNext } = useStateStore(manager.state, (state) => ({
        channels: state.channels,
        initialized: state.initialized,
        hasNext: state.pagination.hasNext,
    }));

    // requested_of survives until the recipient replies, so its presence — not who is
    // looking — is what makes a conversation pending. The manager's channel.updated handler
    // replaces channel.data and returns a new array, so clearing the field re-partitions
    // here on its own with nothing to invalidate.
    const { active, pending } = useMemo(() => {
        const active: Channel[] = [];
        const pending: Channel[] = [];
        for (const channel of channels) {
            (channel.data?.requested_of ? pending : active).push(channel);
        }
        return { active, pending };
    }, [channels]);

    return {
        active,
        pending,
        initialized,
        hasNext,
        loadNext: () => void manager.loadNext(),
    };
}