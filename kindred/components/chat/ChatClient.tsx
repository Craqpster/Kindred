"use client";

import { Plus, SendHorizontal } from "lucide-react";
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

import AttachmentMenu from "@/components/chat/AttachmentMenu";
import ChannelLevelAvatar from "@/components/chat/ChannelLevelAvatar";
import ChatListRow from "@/components/chat/ChatListRow";
import ChatTabs, { type ChatTab } from "@/components/chat/ChatTabs";
import IcebreakerCard from "@/components/chat/IcebreakerCard";
import KindredQuotedMessage from "@/components/chat/KindredQuotedMessage";
import { useChatChannels } from "@/components/chat/useChatChannels";
import { useModeratedSend } from "@/components/chat/useModeratedSend";

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
                    <ComposerComponents>
                        <Window>
                            {/* The chat level lives in the header avatar's ring now, not
                                in a bar of its own below it. */}
                            <ChannelHeader Avatar={ChannelLevelAvatar} />
                            <AutoPromptTrigger />
                            <MessageList Message={ChatMessage} />
                            <PrefillGreeting targetId={greet ? openChannelId : undefined} />
                            <ModeratedMessageComposer />
                        </Window>
                        <Thread />
                    </ComposerComponents>
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
            AttachmentSelector: AttachmentMenu,
            QuotedMessage: KindredQuotedMessage,
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
            // size-8, down from size-9: the composer bar is slimmer now, and a 36px circle
            // stood taller than the 26px control row it sits in, so it read as bolted on
            // rather than part of the bar.
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-600 text-surface transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-bone-300 disabled:text-ink-600"
        >
            <SendHorizontal size={16} strokeWidth={1.5} aria-hidden />
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

// Renders an icebreaker prompt as a distinct card with a "Respond" button, and a reply
// to one with a small badge - everything else falls through to Stream's own MessageUI
// unchanged. Message text/props come in as props here, per stream-chat-react's
// Message={...} convention (see MessageList below), not from a hook.
function ChatMessage(props: Parameters<typeof MessageUI>[0]) {
    // MessageUI itself reads from context, not props - message only shows up on props
    // if a caller explicitly overrides it, which MessageList's Message={ChatMessage}
    // wiring doesn't do. useMessageContext() is the actual source of truth here.
    const { message } = useMessageContext("ChatMessage");
    const { messages } = useChannelStateContext();

    // A reply to a prompt is rendered inside that prompt's card, so it must not also
    // appear as a bubble of its own. Conditional on the prompt actually being loaded:
    // `messages` is one page of history, so an older prompt can be scrolled past, and a
    // reply whose card isn't on screen has to fall through to a normal bubble rather
    // than disappearing from the conversation entirely.
    if (message?.messageType === "prompt_response" && message.promptId) {
        const promptIsLoaded = messages?.some(
            (m) => m.id === message.promptId && m.messageType === "icebreaker_prompt",
        );
        if (promptIsLoaded) return null;
    }

    if (message?.messageType === "icebreaker_prompt") {
        return <IcebreakerCard message={message} />;
    }

    return <MessageUI {...props} />;
}

// The composer at the bottom of the window. The moderation check and the post-send
// bookkeeping both live in useModeratedSend, shared with the icebreaker card's own input
// so a message can't reach the channel through an unmoderated path.
//
// overrideSubmitHandler completely replaces MessageComposer's built-in send - it does
// NOT run alongside it. That's why this has to call sendMessage itself for a message
// that passes the check, and why it has to live in its own component: sendMessage only
// comes from useChannelActionContext(), which requires being a descendant of <Channel>,
// not the component that renders <Channel> itself.
function ModeratedMessageComposer() {
    const { sendMessage } = useChannelActionContext();
    const { messages } = useChannelStateContext();
    const { moderate, finalizeSend, notice } = useModeratedSend();

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
            const { blocked } = await moderate(message.text ?? "");

            if (blocked) {
                // Stream's MessageComposer shows its own generic "Send message request
                // failed" toast whenever this throws - we can't customize that text, so
                // the banner below carries the actual explanation instead.
                throw new Error("Message blocked by moderation");
            }

            // Quoting an icebreaker IS answering it. Tagging the send here is what lets a
            // quote-reply reuse everything the card's own input already goes through: it
            // gets grouped under the prompt, it earns the larger award, and prompt_awards
            // still holds that award to once per person per prompt. Without this a quote
            // would look like an answer and count as an ordinary message.
            const quotedId = message.quoted_message_id;
            const quotedPrompt = quotedId
                ? messages?.find(
                      (m) => m.id === quotedId && m.messageType === "icebreaker_prompt",
                  )
                : undefined;

            const messageToSend = quotedPrompt
                ? { ...message, messageType: "prompt_response" as const, promptId: quotedPrompt.id }
                : message;

            await sendMessage({ localMessage, message: messageToSend, options: sendOptions });

            await finalizeSend({
                cid,
                messageId: localMessage.id,
                text: message.text ?? "",
                promptId: quotedPrompt?.id,
            });
        },
        [sendMessage, moderate, finalizeSend, messages],
    );

    return (
        <>
            {notice && (
                <div className="border-t border-red-700 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {notice.text}
                </div>
            )}
            <MessageComposer overrideSubmitHandler={overrideSubmitHandler} />
        </>
    );
}
