"use client";

import { useEffect, useState } from "react";
import { isDmChannel, useChannelStateContext, useChatContext } from "stream-chat-react";

/// How many OTHER people currently have this conversation open.
///
/// "Watching this channel", not "online in the app" - and the difference matters enough
/// to shape the wording in the UI. Stream's own header calls this Online/Offline, which
/// tells someone their friend is offline while they are actively messaging elsewhere.
/// The pill says "Active now" or says nothing instead.
///
/// Reimplemented rather than imported: Stream's useChannelHeaderOnlineStatus is not
/// exported from the package root and has no deep-import path. It also returns a
/// pre-formatted string, where a count is what a caller can actually build on.
///
/// Watchers, not member presence: our channels are queried with `presence: false`
/// (useChatChannels.ts), so members[x].user.online is whatever was true at query time and
/// then goes stale. `watch: true` IS set, so the watching events below do flow.
export function useChatPresence() {
    const { channel } = useChannelStateContext();
    const { client } = useChatContext();

    const ownId = client.userID;
    const isDm = isDmChannel({ channel, ownUserId: ownId });

    // Own id is excluded up front and on every event: the local user starts watching the
    // moment they open the channel, so counting them would make every conversation look
    // like the other person is right there.
    const [watcherIds, setWatcherIds] = useState<string[]>(() =>
        Object.keys(channel.state?.watchers ?? {}).filter((id) => id !== ownId),
    );

    useEffect(() => {
        setWatcherIds(Object.keys(channel.state?.watchers ?? {}).filter((id) => id !== ownId));

        const onStart = (event: { user?: { id?: string } }) => {
            const id = event.user?.id;
            if (!id || id === ownId) return;
            setWatcherIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        };

        const onStop = (event: { user?: { id?: string } }) => {
            const id = event.user?.id;
            if (!id) return;
            setWatcherIds((prev) => prev.filter((watcher) => watcher !== id));
        };

        const startSub = channel.on("user.watching.start", onStart);
        const stopSub = channel.on("user.watching.stop", onStop);

        return () => {
            startSub.unsubscribe();
            stopSub.unsubscribe();
        };
    }, [channel, ownId]);

    return { othersWatching: watcherIds.length, isDm };
}
