"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Channel as StreamChannel, ChannelFilters, ChannelOptions, ChannelSort, LocalMessage, Message, SendMessageOptions } from "stream-chat";
import {
    Channel,
    ChannelHeader,
    ChannelList,
    MessageComposer,
    MessageList,
    Thread,
    Window,
    useChannelActionContext,
    useChannelStateContext,
    useChatContext,
} from "stream-chat-react";

import { acceptRequest } from "@/app/(app)/chats/actions";
import ChatTabs, { type ChatTab } from "@/components/chat/ChatTabs";
import GroupChatRow from "@/components/chat/GroupChatRow";
import Button from "@/components/ui/Button";
import type { Group } from "@/lib/groups";

// The Stream connection itself now lives in ChatConnectionProvider, wrapping the whole
// (app) shell - by the time this renders, <Chat> is already an ancestor from the
// layout, so ChannelList/Channel pick up client + theme from context on their own.
//
// greetChannelId comes from `?c=` when the user just waved at someone on /meet: that
// conversation opens straight away with the greeting prefilled but unsent.
//
// An id, not a cid — customActiveChannel queries by id, and a cid throws.
export default function ChatClient({
    userId,
    greetChannelId,
    requestCount,
    group,
}: {
    userId: string;
    greetChannelId?: string;
    requestCount: number;
    group: Group | null;
}) {
    const [tab, setTab] = useState<ChatTab>("active");

    const sort: ChannelSort = { last_message_at: -1 };
    const options: ChannelOptions = { limit: 10 };

    const activeFilters: ChannelFilters = { type: "messaging", members: { $in: [userId] } };
    
    const requestFilters: ChannelFilters = {
        type: "messaging",
        members: { $in: [userId] },
        requested_of: userId,
    };

    const dropPending = useCallback(
        (channels: StreamChannel[]) =>
            channels.filter((channel) => channel.data?.requested_of !== userId),
        [userId],
    );

    return (
        // Channel-list width is fixed via the .str-chat.str-chat__channel-list rule in
        // globals.css, not here - see that rule's comment for why an inline/ancestor
        // override doesn't work for this particular library. The flex-1 wrapper below
        // is still needed though: Stream's .str-chat__channel has no flex-grow of its
        // own, so without a wrapper that claims the remaining space, it would only be
        // as wide as its content demands.
        <div className="flex flex-1 min-h-0">
            {/* The channel list sits in a column so the tabs can sit above it. That flip
                is why globals.css overrides Stream's own `flex` on
                .str-chat__channel-list. */}
            <div className="flex w-80 shrink-0 flex-col min-h-0">
                <ChatTabs tab={tab} onChange={setTab} requestCount={requestCount} />

                {/* Both lists stay MOUNTED and the inactive one is hidden, rather than
                    rendering one at a time. Unmounting would re-query on every switch and,
                    worse, ChannelList calls setActiveChannel on mount — so returning to a
                    tab would yank the open conversation out from under the user. `contents`
                    keeps the wrapper out of the layout so the list is still the column's
                    flex child and the globals.css sizing rule applies to it. */}
                <div className={tab === "active" ? "contents" : "hidden"}>
                    {group?.streamChannelId && (
                        <GroupChatRow group={group} channelId={group.streamChannelId} />
                    )}
                    <ChannelList
                        filters={activeFilters}
                        sort={sort}
                        options={options}
                        channelRenderFilterFn={dropPending}
                        customActiveChannel={greetChannelId}
                    />
                </div>

                <div className={tab === "requests" ? "contents" : "hidden"}>
                    <ChannelList
                        filters={requestFilters}
                        sort={sort}
                        options={options}
                        // This list is hidden on load, so letting it claim the message pane
                        // would open a request the user never asked to see.
                        setActiveChannelOnMount={false}
                    />
                </div>
            </div>
            <div className="flex flex-1 min-w-0">
                <Channel>
                    <Window>
                        <ChannelHeader />
                        <MessageList />
                        <AcceptRequestBanner />
                        <PrefillGreeting targetId={greetChannelId} />
                        <ModeratedMessageComposer />
                    </Window>
                    <Thread />
                </Channel>
            </div>
        </div>
    );
}

// Accepting lives here rather than on the list row. Stream's row seams are awkward for
// this — ChannelListItemActionButtons receives no channel prop, and a custom
// ChannelListItemUI would mean reimplementing the avatar, name, preview and timestamp just
// to bolt a button on. Putting it above the composer also reads better: you see who waved
// and what they said, then decide.
function AcceptRequestBanner() {
    const { channel } = useChannelStateContext();
    const { client } = useChatContext();
    const [pending, start] = useTransition();

    // Only the recipient sees this. For the sender, requested_of is the other person.
    if (channel?.data?.requested_of !== client.userID) return null;

    return (
        <div className="flex items-center gap-3 border-t border-bone-300 bg-bone-100 px-4 py-3">
            <p className="flex-1 text-sm text-ink-900">
                Someone new wants to chat. Accept to move this into your active chats.
            </p>
            <Button
                variant="accent"
                size="sm"
                disabled={pending}
                onClick={() =>
                    start(async () => {
                        const formData = new FormData();
                        // channel.id, not cid — acceptChatRequest queries Stream by id.
                        formData.set("channel_id", channel.id ?? "");
                        await acceptRequest(formData);
                    })
                }
            >
                {pending ? "Accepting…" : "Accept"}
            </Button>
        </div>
    );
}

const GREETING = "👋";

// Types the greeting into the composer without sending it, so the wave still ends with
// a deliberate press of Send by the person doing the waving.
//
//
function PrefillGreeting({ targetId }: { targetId?: string }) {
    const { channel } = useChannelStateContext();
    const filled = useRef(false);

    useEffect(() => {
        if (filled.current) return;
        // channel.id, not channel.cid — `?c=` carries the id half of the cid, matching
        // what customActiveChannel needs.
        if (!targetId || !channel || channel.id !== targetId) return;

        const { textComposer } = channel.messageComposer;
        if (!textComposer.textIsEmpty) return;

        textComposer.setText(GREETING);
        filled.current = true;
    }, [targetId, channel]);

    return null;
}

// Stream's own moderation turned out to need a paid plan we don't have (see the PR
// notes), so this checks messages against OpenAI's free Moderation endpoint instead,
// via our own /api/moderate-message route (keeps the OpenAI key server-side only).
//
// overrideSubmitHandler completely replaces MessageComposer's built-in send - it does
// NOT run alongside it. That's why this has to call sendMessage itself for a message
// that passes the check, and why it has to live in its own component: sendMessage only
// comes from useChannelActionContext(), which requires being a descendant of <Channel>,
// not the component that renders <Channel> itself.
function ModeratedMessageComposer() {
    const { sendMessage } = useChannelActionContext();
    const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [showWarning, setShowWarning] = useState(false);

    // Ticks the countdown once a cooldown is active, and clears itself once it expires.
    useEffect(() => {
        if (!cooldownUntil) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining === 0) setCooldownUntil(null);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [cooldownUntil]);

    // The first couple of flagged messages are warning-only (no cooldownUntil from the
    // route) - show the warning for a few seconds rather than leaving it up forever.
    useEffect(() => {
        if (!showWarning) return;
        const timeout = setTimeout(() => setShowWarning(false), 6000);
        return () => clearTimeout(timeout);
    }, [showWarning]);

    const overrideSubmitHandler = useCallback(
        async ({
            localMessage,
            message,
            sendOptions,
        }: {
            cid: string;
            localMessage: LocalMessage;
            message: Message;
            sendOptions: SendMessageOptions;
        }) => {
            let flagged = false;
            let newCooldownUntil: number | null = null;

            if (message.text?.trim()) {
                try {
                    const res = await fetch("/api/moderate-message", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: message.text }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        flagged = data.flagged;
                        newCooldownUntil = data.cooldownUntil ?? null;
                    }
                    // A non-ok response here is treated the same as flagged: false -
                    // fail open, same policy as the route itself uses for the OpenAI call.
                } catch {
                    // Network error reaching our own route - fail open.
                }
            }

            if (flagged) {
                if (newCooldownUntil) {
                    setCooldownUntil(newCooldownUntil);
                } else {
                    setShowWarning(true);
                }
                // Stream's MessageComposer shows its own generic "Send message request
                // failed" toast whenever this throws - we can't customize that text, so
                // the banner below carries the actual explanation instead.
                throw new Error("Message blocked by moderation");
            }

            await sendMessage({ localMessage, message, options: sendOptions });
        },
        [sendMessage],
    );

    return (
        <>
            {cooldownUntil && secondsLeft > 0 ? (
                <div className="border-t border-red-700 bg-red-50 px-4 py-2 text-sm text-red-700">
                    Please keep this chat respectful — offensive language isn&apos;t
                    allowed here, and repeated violations may result in restrictions on
                    your account. You can send messages again in {secondsLeft}s.
                </div>
            ) : (
                showWarning && (
                    <div className="border-t border-red-700 bg-red-50 px-4 py-2 text-sm text-red-700">
                        That message wasn&apos;t sent — please keep this chat respectful.
                        Continuing to send offensive messages will temporarily restrict
                        you from chatting.
                    </div>
                )
            )}
            <MessageComposer overrideSubmitHandler={overrideSubmitHandler} />
        </>
    );
}
