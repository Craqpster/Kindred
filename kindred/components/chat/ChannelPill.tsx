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
const MAIN_PANEL_CLASS = "str-chat__main-panel-inner str-chat__message-list-main-panel";

export default function ChannelPill({ children }: PropsWithChildren) {
    const { channel } = useChannelStateContext();
    const { client } = useChatContext();
    const { displayTitle, displayImage } = useChannelPreviewInfo({ channel });
    const { othersWatching, isDm } = useChatPresence();

    const { typing = {} } = useTypingContext();
    const someoneElseIsTyping = Object.values(typing).some(
        ({ parent_id, user }) => user?.id !== client.userID && !parent_id,
    );

    const status = isDm
        ? othersWatching > 0
            ? "Active now"
            : null
        : othersWatching > 0
          ? `${othersWatching} here now`
          : null;

    return (
        // The child selector [&_.str-chat__list]:pt-28 adds the spacing between the pill and the "Today" text
        <div className={`${MAIN_PANEL_CLASS} [&_.str-chat__list]:pt-28`}>
            <div className="pointer-events-none absolute inset-x-0 top-3 z-3 flex justify-center px-4">
                <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-ink-900/8 bg-surface/70 py-2 pr-6 pl-2 shadow-card backdrop-blur-xl">
                    <ChannelLevelAvatar
                        ringSize="lg"
                        imageUrl={displayImage}
                        userName={displayTitle}
                    />

                    <div className="flex min-w-0 flex-col">
                        <span className="truncate text-meta font-medium text-ink-900">
                            {displayTitle}
                        </span>

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