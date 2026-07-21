"use client";

import { Lightbulb, Plus, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LocalMessage, Message, SendMessageOptions } from "stream-chat";
import {
    Channel,
    ChannelHeader,
    ComponentProvider,
    MessageComposer,
    MessageList,
    MessageUI,
    Thread,
    Window,
    useChannelActionContext,
    useChannelStateContext,
    useChatContext,
    useComponentContext,
    useMessageComposerHasSendableData,
    useMessageContext,
    type SendButtonProps,
} from "stream-chat-react";

import { acceptRequest } from "@/app/(app)/chats/actions";
import { ActivePromptProvider, useActivePrompt } from "@/components/chat/ActivePromptContext";
import ChatListRow from "@/components/chat/ChatListRow";
import ChatTabs, { type ChatTab } from "@/components/chat/ChatTabs";
import { useChatChannels } from "@/components/chat/useChatChannels";
import { getChatLevel } from "@/lib/chat-level";

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
                    <ActivePromptProvider>
                        <ComposerComponents>
                            <Window>
                                <ChannelHeader />
                                <ChatXpBadge />
                                <AutoPromptTrigger />
                                <MessageList Message={ChatMessage} />
                                <PrefillGreeting targetId={greet ? openChannelId : undefined} />
                                <PromptButton />
                                <ModeratedMessageComposer />
                            </Window>
                            <Thread />
                        </ComposerComponents>
                    </ActivePromptProvider>
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

// Swaps two of Stream's composer components for ours.
//
// In v14 these are NOT props on <Channel> — ChannelProps carries no component keys, and the
// composer reads them from ComponentContext. So this re-provides that context from inside
// <Channel>, spreading the existing value first: ComponentProvider replaces the context
// wholesale, and dropping the ~60 defaults Channel put there would blank out most of the UI.
function ComposerComponents({ children }: { children: React.ReactNode }) {
    const existing = useComponentContext();

    const value = useMemo(
        () => ({
            ...existing,
            SendButton: KindredSendButton,
            AttachmentSelectorInitiationButtonContents: KindredAttachmentIcon,
        }),
        [existing],
    );

    return <ComponentProvider value={value}>{children}</ComponentProvider>;
}

// Stream hands an override only `sendMessage` — `disabled` is NOT passed, and the default
// computes it itself. Without this hook the button stays live on an empty composer.
//
// Sized and weighted explicitly: Stream sizes its own icons via `.str-chat__icon--send`,
// which a lucide icon never matches, and lucide's default stroke (2 at 24px) is heavier than
// Stream's (1.5 at 20px) next to the emoji and attachment icons.
function KindredSendButton({ sendMessage, ...rest }: SendButtonProps) {
    const canSend = useMessageComposerHasSendableData();

    return (
        <button
            type="button"
            aria-label="Send"
            disabled={!canSend}
            onClick={sendMessage}
            {...rest}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-600 text-surface transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-bone-300 disabled:text-ink-600"
        >
            <SendHorizontal size={18} strokeWidth={1.5} aria-hidden />
        </button>
    );
}

// Only the icon inside the "+" button, which leaves Stream's file input, popover and portal
// machinery untouched. Replacing the whole AttachmentSelector would mean rebuilding those.
function KindredAttachmentIcon() {
    return <Plus size={20} strokeWidth={1.5} aria-hidden />;
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

// How long a chat can sit with no new messages before the next person to open it gets
// offered a fresh icebreaker. Arbitrary but generous - this is a nudge, not a nag.
const QUIET_THRESHOLD_MS = 48 * 60 * 60 * 1000;

// Watches this channel's most recent message and asks the server for a fresh icebreaker
// prompt if the chat looks abandoned. Guards against re-triggering on every render (via
// firedRef) and against stacking prompts if the last message is already one (a second
// participant's tab could otherwise fire this around the same time).
//
// Channel-type agnostic - works the same for a 1:1 or a group, since it only ever looks
// at "how long since the last message" and posts through the same channelCid-based route.
function AutoPromptTrigger() {
    const { channel, messages } = useChannelStateContext();
    const firedRef = useRef(false);

    useEffect(() => {
        firedRef.current = false;
    }, [channel.cid]);

    useEffect(() => {
        if (firedRef.current || !messages) return;

        const lastMessage = messages.at(-1);
        const isQuiet =
            !lastMessage?.created_at ||
            Date.now() - new Date(lastMessage.created_at).getTime() > QUIET_THRESHOLD_MS;
        const alreadyPrompted = lastMessage?.messageType === "icebreaker_prompt";

        if (isQuiet && !alreadyPrompted) {
            firedRef.current = true;
            fetch("/api/chat-prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelCid: channel.cid }),
            }).catch(() => {});
        }
    }, [channel, messages]);

    return null;
}

// The on-demand version of AutoPromptTrigger - drops a new random icebreaker into the
// chat right now, regardless of how recently someone last spoke.
function PromptButton() {
    const { channel } = useChannelStateContext();
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        try {
            await fetch("/api/chat-prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelCid: channel.cid }),
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            title="Get an icebreaker prompt"
            className="flex items-center gap-1.5 border-t border-metro-blue/20 bg-mist px-4 py-1.5 text-xs font-medium text-metro-blue hover:bg-iceland/20 disabled:opacity-50"
        >
            <Lightbulb className="h-3.5 w-3.5" />
            {loading ? "Sending..." : "Send an icebreaker"}
        </button>
    );
}

// Renders an icebreaker prompt as a distinct card with a "Respond" button, and a reply
// to one with a small badge - everything else falls through to Stream's own MessageUI
// unchanged. Message text/props come in as props here, per stream-chat-react's
// Message={...} convention (see MessageList below), not from a hook.
function ChatMessage(props: Parameters<typeof MessageUI>[0]) {
    // MessageUI itself reads from context, not props - message only shows up on props
    // if a caller explicitly overrides it, which MessageList's Message={ChatMessage}
    // wiring doesn't do. useMessageContext() is the actual source of truth here.
    const { message } = useMessageContext("ChatMessage");
    const { setActivePrompt } = useActivePrompt();

    if (message?.messageType === "icebreaker_prompt") {
        return (
            <div className="my-2 mx-auto max-w-sm rounded-2xl border border-metro-blue/20 bg-mist px-4 py-3 text-center">
                <p className="mb-1 text-xs font-medium text-metro-blue">✨ Icebreaker</p>
                <p className="mb-2 text-sm text-star-sapphire">{message.text}</p>
                <button
                    type="button"
                    onClick={() => setActivePrompt({ id: message.id, text: message.text ?? "" })}
                    className="rounded-full bg-metro-blue px-3 py-1 text-xs font-medium text-white hover:bg-metro-blue/90"
                >
                    Respond
                </button>
            </div>
        );
    }

    if (message?.messageType === "prompt_response") {
        return (
            <div>
                <p className="mb-0.5 text-center text-[10px] font-medium text-metro-blue">
                    ✨ Prompt response — XP earned
                </p>
                <MessageUI {...props} />
            </div>
        );
    }

    return <MessageUI {...props} />;
}

// A single XP total shared by everyone in this chat (not a per-person stat - that's
// profiles.confidence_level, shown elsewhere). Refetches whenever the message count
// changes, so it stays current whether the XP-worthy message was sent by this user or
// the other person - lib/confidence.ts awards it to channel_xp regardless of sender.
//
// Channel-type agnostic - a group's channel_cid works exactly like a 1:1's for this
// purpose, since channel_xp is keyed by cid, not by member count.
function ChatXpBadge() {
    const { channel, messages } = useChannelStateContext();
    const [xp, setXp] = useState<number | null>(null);

    const refetch = useCallback(() => {
        fetch(`/api/chat-xp?channelCid=${encodeURIComponent(channel.cid)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data) setXp(data.xp);
            })
            .catch(() => {});
    }, [channel]);

    useEffect(refetch, [refetch, messages?.length]);

    // A new message means the badge should re-check right away, but confidence.ts
    // awards XP in a background call that lands slightly after the message itself, so
    // that first refetch can still read the old value. This event fires once the award
    // has actually landed (see ModeratedMessageComposer below), for a second, correctly
    // timed refetch - for both participants, not just whoever sent the message.
    useEffect(() => {
        const handleXpUpdated = () => refetch();
        channel.on("chat_xp_updated", handleXpUpdated);
        return () => channel.off("chat_xp_updated", handleXpUpdated);
    }, [channel, refetch]);

    if (xp === null) return null;

    const { level, xpIntoLevel, xpPerLevel } = getChatLevel(xp);

    return (
        <div className="border-b border-metro-blue/20 bg-mist px-4 py-1.5">
            <div className="flex items-center justify-between text-sm text-star-sapphire">
                <span>Chat Level {level}</span>
                <span className="text-xs text-metro-blue">
                    {xpIntoLevel}/{xpPerLevel} to next level
                </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-metro-blue/15">
                <div
                    className="h-1.5 rounded-full bg-metro-blue transition-all"
                    style={{ width: `${(xpIntoLevel / xpPerLevel) * 100}%` }}
                />
            </div>
        </div>
    );
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
    const { activePrompt, setActivePrompt } = useActivePrompt();
    const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [showWarning, setShowWarning] = useState(false);

    // Clicking "Respond" on a prompt card sets activePrompt - drop its text into the
    // composer the same way PrefillGreeting does for a wave, so sending is still a
    // deliberate action rather than something that happens on click alone.
    useEffect(() => {
        if (!activePrompt) return;
        const { textComposer } = channel.messageComposer;
        if (!textComposer.textIsEmpty) return;
        textComposer.setText(activePrompt.text);
    }, [activePrompt, channel]);

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
            cid,
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

            // Tag this send as a reply to whatever prompt was active when Send was
            // pressed - reading activePrompt here (not a stale closure) is why this
            // callback lists it as a dependency below.
            const respondingTo = activePrompt;
            const messageToSend = respondingTo
                ? { ...message, messageType: "prompt_response" as const, promptId: respondingTo.id }
                : message;

            await sendMessage({ localMessage, message: messageToSend, options: sendOptions });
            if (respondingTo) setActivePrompt(null);

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

            // Best-effort, background signal for confidence_level growth - never
            // awaited in a way that could delay or fail the send itself, since the
            // message has already gone through by this point.
            if (message.text?.trim()) {
                fetch("/api/confidence", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        channelCid: cid,
                        messageId: localMessage.id,
                        text: message.text,
                        isPromptResponse: !!respondingTo,
                    }),
                })
                    // Tell ChatXpBadge (both participants') the award has landed and it's
                    // safe to refetch, rather than making it guess how long to wait.
                    .then(() => channel.sendEvent({ type: "chat_xp_updated" }))
                    .catch(() => {});
            }
        },
        [sendMessage, channel, client.userID, activePrompt, setActivePrompt],
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
