// /components/chat/ChatClient.tsx
"use client";

import { Plus, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LocalMessage, Message, SendMessageOptions } from "stream-chat";
import {
    Channel,
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
import ChannelPill from "@/components/chat/ChannelPill";
import ChatListRow from "@/components/chat/ChatListRow";
import ChatTabs, { type ChatTab } from "@/components/chat/ChatTabs";
import IcebreakerCard from "@/components/chat/IcebreakerCard";
import KindredQuotedMessage from "@/components/chat/KindredQuotedMessage";
import GameControllerBar from "@/components/chat/games/GameControllerBar";
import GameInviteCard from "@/components/chat/games/GameInviteCard";
import { useChatChannels } from "@/components/chat/useChatChannels";
import { useModeratedSend } from "@/components/chat/useModeratedSend";

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
    const [tab, setTab] = useState<ChatTab>(initialTab);
    const { active, pending, initialized } = useChatChannels(userId);

    const channels = tab === "active" ? active : pending;

    useOpenChannel(openChannelId, openChannelType);

    return (
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

function useOpenChannel(channelId: string | undefined, type: "messaging" | "team") {
    const { client, setActiveChannel } = useChatContext();
    const opened = useRef(false);

    useEffect(() => {
        if (opened.current || !channelId) return;

        opened.current = true;
        setActiveChannel(client.channel(type, channelId));
    }, [channelId, type, client, setActiveChannel]);
}

function ComposerComponents({ children }: { children: React.ReactNode }) {
    const existing = useComponentContext();

    const value = useMemo(
        () => ({
            ...existing,
            SendButton: KindredSendButton,
            AttachmentSelectorInitiationButtonContents: KindredAttachmentIcon,
            AttachmentSelector: AttachmentMenu,
            QuotedMessage: KindredQuotedMessage,
            MessageListMainPanel: ChannelPill,
        }),
        [existing],
    );

    return <ComponentProvider value={value}>{children}</ComponentProvider>;
}

function KindredSendButton({ sendMessage, ...rest }: SendButtonProps) {
    const canSend = useMessageComposerHasSendableData();

    return (
        <button
            type="button"
            aria-label="Send"
            disabled={!canSend}
            onClick={sendMessage}
            {...rest}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-600 text-surface transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-bone-300 disabled:text-ink-600"
        >
            <SendHorizontal size={16} strokeWidth={1.5} aria-hidden />
        </button>
    );
}

function KindredAttachmentIcon() {
    return <Plus size={20} strokeWidth={1.5} aria-hidden />;
}

const GREETING = "👋";

function PrefillGreeting({ targetId }: { targetId?: string }) {
    const { channel } = useChannelStateContext();
    const filled = useRef(false);

    useEffect(() => {
        if (filled.current) return;
        if (!targetId || !channel || channel.id !== targetId) return;

        const { textComposer } = channel.messageComposer;
        if (!textComposer.textIsEmpty) return;

        textComposer.setText(GREETING);
        filled.current = true;
    }, [targetId, channel]);

    return null;
}

const QUIET_THRESHOLD_MS = 48 * 60 * 60 * 1000;

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

function ChatMessage(props: Parameters<typeof MessageUI>[0]) {
    const { message } = useMessageContext("ChatMessage");
    const { channel, messages } = useChannelStateContext();

    if (message?.type === "deleted") {
        return <MessageUI {...props} />;
    }

    if (message?.messageType === "game_invite") {
        return <GameInviteCard message={message} channel={channel} />;
    }

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

function ModeratedMessageComposer() {
    const { sendMessage } = useChannelActionContext();
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
                throw new Error("Message blocked by moderation");
            }

            await sendMessage({ localMessage, message, options: sendOptions });

            await finalizeSend({
                cid,
                messageId: localMessage.id,
                text: message.text ?? "",
            });
        },
        [sendMessage, moderate, finalizeSend],
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