"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel as StreamChannel, LocalMessage, Message, SendMessageOptions } from "stream-chat";
import {
    Channel,
    ChannelHeader,
    MessageComposer,
    MessageList,
    Thread,
    Window,
    useChannelActionContext,
    useChannelStateContext,
    useChatContext,
} from "stream-chat-react";

import ChatListRow from "@/components/chat/ChatListRow";
import ChatTabs, { type ChatTab } from "@/components/chat/ChatTabs";
import { useChatChannels } from "@/components/chat/useChatChannels";

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
}: {
    userId: string;
    greetChannelId?: string;
}) {
    const [tab, setTab] = useState<ChatTab>("active");
    const { active, pending, initialized } = useChatChannels(userId);

    const channels = tab === "active" ? active : pending;

    // A wave lands in Pending, so look across both rather than the visible tab only.
    useOpenGreetChannel(greetChannelId, active, pending);

    return (
        // Stream's .str-chat__channel has no flex-grow of its own, so without a wrapper
        // claiming the remaining space it would only be as wide as its content demands.
        <div className="flex flex-1 min-h-0 bg-bone-100">
            <div className="flex w-80 shrink-0 flex-col min-h-0 border-r border-ink-900/8">
                <ChatTabs tab={tab} onChange={setTab} pendingCount={pending.length} />

                <div className="flex-1 overflow-y-auto px-2 pb-3">
                    {!initialized ? (
                        <p className="p-3 text-sm text-ink-600">Loading…</p>
                    ) : channels.length === 0 ? (
                        <p className="p-3 text-sm text-ink-600">
                            {tab === "active"
                                ? "No chats yet. Say hi to someone on Meet."
                                : "Nothing waiting on a reply."}
                        </p>
                    ) : (
                        channels.map((channel) => (
                            <ChatListRow key={channel.cid} channel={channel} />
                        ))
                    )}
                </div>
            </div>

            <div className="flex flex-1 min-w-0">
                <Channel>
                    <Window>
                        <ChannelHeader />
                        <MessageList />
                        <PrefillGreeting targetId={greetChannelId} />
                        <ModeratedMessageComposer />
                    </Window>
                    <Thread />
                </Channel>
            </div>
        </div>
    );
}

/// Opens the channel from `?c=` once the list has loaded it.
///
/// This used to be ChannelList's `customActiveChannel`. Without that component we do it
/// ourselves, and only once — re-running would drag the user back to the wave every time
/// the channel list reordered.
function useOpenGreetChannel(
    greetChannelId: string | undefined,
    active: StreamChannel[],
    pending: StreamChannel[],
) {
    const { setActiveChannel } = useChatContext();
    const opened = useRef(false);

    useEffect(() => {
        if (opened.current || !greetChannelId) return;

        // `?c=` carries the channel id, not the cid.
        const target = [...active, ...pending].find(
            (channel) => channel.id === greetChannelId,
        );
        if (!target) return;

        opened.current = true;
        setActiveChannel(target);
    }, [greetChannelId, active, pending, setActiveChannel]);
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
