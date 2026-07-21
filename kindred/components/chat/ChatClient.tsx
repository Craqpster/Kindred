"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalMessage, Message, SendMessageOptions } from "stream-chat";
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

import { acceptRequest } from "@/app/(app)/chats/actions";
import ChatListRow from "@/components/chat/ChatListRow";
import ChatTabs, { type ChatTab } from "@/components/chat/ChatTabs";
import { useChatChannels } from "@/components/chat/useChatChannels";

// The Stream connection itself now lives in ChatConnectionProvider, wrapping the whole
// (app) shell - by the time this renders, <Chat> is already an ancestor from the
// layout, so ChannelList/Channel pick up client + theme from context on their own.
//
// openChannelId comes from `?c=` — set both by a wave on /meet and by forming a group.
// openChannelType tells us which Stream channel type it is, so the channel can be built
// directly rather than looked up. `greet` is what separates the two cases: only a wave
// arrives with 👋 prefilled.
//
// An id, not a cid — client.channel() rejects a cid.
export default function ChatClient({
    userId,
    openChannelId,
    openChannelType = "messaging",
    greet = false,
    initialTab = "active",
}: {
    userId: string;
    openChannelId?: string;
    openChannelType?: "messaging" | "team";
    greet?: boolean;
    initialTab?: ChatTab;
}) {
    // Seeded from the server so arriving at a pending conversation doesn't drop the user on
    // Active, where its row isn't. Only the initial value — switching tabs is local state.
    const [tab, setTab] = useState<ChatTab>(initialTab);
    const { active, pending, initialized } = useChatChannels(userId);

    const channels = tab === "active" ? active : pending;

    useOpenChannel(openChannelId, openChannelType);

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
                        <PrefillGreeting targetId={greet ? openChannelId : undefined} />
                        <ModeratedMessageComposer />
                    </Window>
                    <Thread />
                </Channel>
            </div>
        </div>
    );
}

/// Opens the channel named by `?c=` / `?type=`.
///
/// Constructs the channel rather than hunting for it in the loaded lists. A just-created
/// group has no messages, so it can fall outside the first page of a last_message_at-sorted
/// query — searching would find nothing and the redirect would land on an empty pane.
/// client.channel() sets cid synchronously and <Channel> watches whatever it gets from
/// context, so this needs neither list membership nor a watch() call of its own.
///
/// Runs once. Re-running would drag the user back to this channel every time the list
/// reordered underneath them.
function useOpenChannel(channelId: string | undefined, type: "messaging" | "team") {
    const { client, setActiveChannel } = useChatContext();
    const opened = useRef(false);

    useEffect(() => {
        if (opened.current || !channelId) return;

        opened.current = true;
        // An id, not a cid — client.channel() rejects a cid here.
        setActiveChannel(client.channel(type, channelId));
    }, [channelId, type, client, setActiveChannel]);
}

const GREETING = "👋";

// Types the greeting into the composer without sending it, so the wave still ends with
// a deliberate press of Send by the person doing the waving.
//
// Gated on `?greet=1`, not merely on a channel being opened: forming a group also redirects
// here with `?c=`, and that conversation should not arrive with a 👋 already typed.
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
    const { channel } = useChannelStateContext();
    const { client } = useChatContext();
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

            // Replying IS accepting: clearing requested_of moves the conversation out of
            // Pending for both people. Only the recipient can do it — for the sender,
            // requested_of names the other person, so this is a no-op on their side and
            // their own wave stays pending until it's answered.
            //
            // After the send, not before: a message blocked by moderation should leave the
            // request exactly as it was. The action re-checks ownership server-side, so a
            // stale channel here can't accept anything it shouldn't.
            if (channel?.data?.requested_of === client.userID && channel.id) {
                const formData = new FormData();
                // channel.id, not cid — acceptChatRequest queries Stream by id.
                formData.set("channel_id", channel.id);
                await acceptRequest(formData);
            }
        },
        [sendMessage, channel, client.userID],
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
