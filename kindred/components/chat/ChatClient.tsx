"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import ChatTabs, { type ChatTab } from "@/components/chat/ChatTabs";
import ConversationRow from "@/components/chat/ConversationRow";
import Thread from "@/components/chat/Thread";
import { useChatRealtime } from "@/components/chat/ChatRealtimeProvider";
import type { ChatConversation, ChatMessage, ConversationXp } from "@/lib/chat/types";

/// The two-pane chat surface: the list of conversations, and whichever one is open.
///
/// Owns only which tab is showing. The list itself comes from the shell's realtime
/// subscription, and everything about an open conversation belongs to Thread.
export default function ChatClient({
    userId,
    openConversationId,
    initialMessages,
    initialXp,
    greet = false,
    initialTab = "active",
}: {
    userId: string;
    openConversationId?: string;
    initialMessages: ChatMessage[];
    initialXp: ConversationXp | null;
    greet?: boolean;
    initialTab?: ChatTab;
}) {
    const router = useRouter();
    const { conversations } = useChatRealtime();
    const [tab, setTab] = useState<ChatTab>(initialTab);

    const { active, pending } = useMemo(() => {
        const active: ChatConversation[] = [];
        const pending: ChatConversation[] = [];
        for (const conversation of conversations) {
            (conversation.pending ? pending : active).push(conversation);
        }
        return { active, pending };
    }, [conversations]);

    const shown = tab === "active" ? active : pending;
    const open = conversations.find((conversation) => conversation.id === openConversationId);

    return (
        <div className="flex flex-1 min-h-0 bg-bone-100">
            <div className="flex w-80 shrink-0 flex-col min-h-0 border-r border-ink-900/8">
                <ChatTabs tab={tab} onChange={setTab} pendingCount={pending.length} />

                <div className="flex-1 overflow-y-auto px-2 pb-3">
                    {shown.length === 0 ? (
                        <p className="p-3 text-sm text-ink-600">
                            {tab === "active"
                                ? "No chats yet. Say hi to someone on Meet."
                                : "Nothing waiting on a reply."}
                        </p>
                    ) : (
                        shown.map((conversation) => (
                            <ConversationRow
                                key={conversation.id}
                                conversation={conversation}
                                selected={conversation.id === openConversationId}
                                onOpen={(id) => router.push(`/chats?c=${encodeURIComponent(id)}`)}
                            />
                        ))
                    )}
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
                {open ? (
                    <Thread
                        key={open.id}
                        userId={userId}
                        conversation={open}
                        initialMessages={initialMessages}
                        initialXp={initialXp}
                        greet={greet}
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center p-8 text-meta text-ink-600">
                        Pick a conversation to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
