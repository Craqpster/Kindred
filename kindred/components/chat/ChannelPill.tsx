"use client";

import type { PropsWithChildren } from "react";
import {
    TypingIndicatorHeader,
    useChannelPreviewInfo,
    useChannelStateContext,
    useChatContext,
    useTypingContext,
} from "stream-chat-react";

import ChannelLevelAvatar from "@/components/chat/ChannelLevelAvatar";
import { useChatPresence } from "@/components/chat/useChatPresence";

// Stream's own class names for this slot, reproduced exactly. They are not decoration:
// str-chat__main-panel-inner carries `position: relative` (the containing block every
// floating overlay in the SDK anchors to) and declares
// --str-chat__message-list-scroll-max-width, which the message list reads for its width.
// Dropping either would break layout well beyond this component.
const MAIN_PANEL_CLASS = "str-chat__main-panel-inner str-chat__message-list-main-panel";

/// The channel header, as a frosted pill floating over the conversation.
///
/// Replaces the full-width 84px bar. That bar spent a whole band of the window on a name
/// and an avatar and drew a hard line between the conversation and the app around it; the
/// pill gives the band back and matches AppDock, which already floats frosted over
/// scrolling content.
///
/// Registered as ComponentContext.MessageListMainPanel, which is the supported way into
/// this part of the tree - it puts the pill inside the same relative box the SDK uses for
/// its own floating date separator and notifications, without touching Window's children.
export default function ChannelPill({ children }: PropsWithChildren) {
    const { channel } = useChannelStateContext();
    const { client } = useChatContext();
    const { displayImage, displayTitle, groupChannelDisplayInfo } = useChannelPreviewInfo({
        channel,
    });
    const { othersWatching, isDm } = useChatPresence();

    // Same test Stream's own header subtitle uses: other people, in this channel rather
    // than in a thread. TypingIndicatorHeader renders null on its own when nobody is
    // typing, but we need to know BEFORE rendering so the status can be swapped out
    // instead of stacked under it.
    const { typing = {} } = useTypingContext();
    const someoneElseIsTyping = Object.values(typing).some(
        ({ parent_id, user }) => user?.id !== client.userID && !parent_id,
    );

    // "Active now" means someone else has THIS conversation open - see useChatPresence for
    // why that is not the same as being online. Saying nothing when they don't is
    // deliberate: the alternative reads as "Offline", which would be a claim we cannot
    // actually make.
    const status = isDm
        ? othersWatching > 0
            ? "Active now"
            : null
        : othersWatching > 0
          ? `${othersWatching} here now`
          : null;

    return (
        <div className={MAIN_PANEL_CLASS}>
            {/* The band spans the pane and centres the pill; pointer-events-none so the
                empty space either side does not swallow clicks meant for messages behind
                it. z-3 clears the SDK's own overlays (floating date 1, notifications 2). */}
            <div className="pointer-events-none absolute inset-x-0 top-3 z-3 flex justify-center px-4">
                <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-ink-900/8 bg-surface/70 py-1 pr-4 pl-1 shadow-card backdrop-blur-xl">
                    {/* displayMembers and imageUrl are what make a GROUP render its avatar
                        stack rather than a single initial - the same three values
                        ChannelHeader feeds its own avatar. */}
                    <ChannelLevelAvatar
                        ringSize="compact"
                        size="md"
                        displayMembers={groupChannelDisplayInfo?.members}
                        imageUrl={displayImage}
                        userName={displayTitle}
                    />

                    <div className="flex min-w-0 flex-col">
                        {/* A centred pill has far less room than the full-width grid this
                            replaced, so a long group name has to truncate rather than
                            stretch the pill across the pane. */}
                        <span className="truncate text-meta font-medium text-ink-900">
                            {displayTitle}
                        </span>

                        {/* Typing REPLACES presence rather than stacking with it: it is
                            the more specific and more immediate fact about the same
                            person, and two lines of status would grow the pill. */}
                        <span className="truncate text-label text-ink-600 empty:hidden">
                            {someoneElseIsTyping ? <TypingIndicatorHeader /> : status}
                        </span>
                    </div>
                </div>
            </div>

            {children}
        </div>
    );
}
