// Custom fields we store on Stream channels.
//
// stream-chat ships `CustomChannelData` as an empty interface specifically so apps can
// augment it — `ChannelData` is `CustomChannelData & {...}`, so without this the extra
// fields are a type error even though the API accepts them at runtime.
//
// This also types `ChannelFilters` (which is built from `CustomChannelData`), so the
// Requests section can filter on `requested_of` with autocomplete rather than a cast.
import "stream-chat";

declare module "stream-chat" {
    interface CustomChannelData {
        /// Who sent the wave that opened this channel.
        requested_by?: string;
        /// Who received it. Their Chats tab should file this under Requests until they
        /// accept, rather than dropping it in the main inbox.
        requested_of?: string;

        /// The channel's display name — the group title for `team` channels. Stream
        /// leaves this out of `ChannelData` on purpose so apps declare it themselves:
        /// `ChannelFilters` is built from `Omit<CustomChannelData, 'name'>`, which only
        /// makes sense if `name` is expected to live here. Without this, setting a group
        /// title in lib/stream.ts is a type error even though the API accepts it.
        name?: string;
    }
}