"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelFilters, ChannelOptions, ChannelSort, LocalMessage, Message, SendMessageOptions } from "stream-chat";
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
} from "stream-chat-react";

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
            <ChannelList
                filters={filters}
                sort={sort}
                options={options}
                customActiveChannel={greetChannelId}
            />
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
