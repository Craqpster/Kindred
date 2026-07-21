"use client";

import { useCallback, useSyncExternalStore } from "react";
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

    // Watchers are an external store that Stream already maintains, so this reads them
    // rather than mirroring them into React state. Two things fall out of that: no
    // setState-inside-an-effect (which React Compiler rightly flags as cascading renders),
    // and no stale copy to re-seed when the channel changes.
    //
    // The snapshot is a NUMBER on purpose. useSyncExternalStore compares snapshots by
    // identity, so returning the watcher array would allocate a new one on every read and
    // spin forever; a count compares cleanly.
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const start = channel.on("user.watching.start", onStoreChange);
            const stop = channel.on("user.watching.stop", onStoreChange);
            return () => {
                start.unsubscribe();
                stop.unsubscribe();
            };
        },
        [channel],
    );

    // Own id excluded: the local user starts watching the moment they open the channel,
    // so counting them would make every conversation look like someone else is present.
    const othersWatching = useSyncExternalStore(
        subscribe,
        () => Object.keys(channel.state?.watchers ?? {}).filter((id) => id !== ownId).length,
        // Server render: nobody is watching as far as the HTML is concerned.
        () => 0,
    );

    return { othersWatching, isDm };
}
