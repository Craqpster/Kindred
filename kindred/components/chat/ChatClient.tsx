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

    // Groups and DMs are different kinds of thing to walk into — one has three strangers in
    // it, the other has one person you waved at — so they get their own runs rather than
    // interleaving by whoever spoke last. Order within each section is untouched, so recency
    // still decides who is at the top of their own list.
    //
    // Pending is deliberately NOT split: a wave is always a DM, so a "Groups" heading there
    // would introduce a section that can never have anything in it.
    const sections =
        tab === "pending"
            ? [{ heading: null, rows: shown }]
            : [
                  { heading: "Groups", rows: shown.filter((c) => c.kind === "group") },
                  { heading: "Direct messages", rows: shown.filter((c) => c.kind === "dm") },
              ];

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
                        sections.map(
                            ({ heading, rows }) =>
                                // A heading with nothing under it is worse than no heading:
                                // it reads as something missing rather than something absent.
                                rows.length > 0 && (
                                    <section key={heading ?? "all"}>
                                        {heading && (
                                            <h2 className="px-3 pt-3 pb-1 text-label uppercase text-ink-600">
                                                {heading}
                                            </h2>
                                        )}

                                        {rows.map((conversation) => (
                                            <ConversationRow
                                                key={conversation.id}
                                                conversation={conversation}
                                                selected={conversation.id === openConversationId}
                                                onOpen={(id) =>
                                                    router.push(`/chats?c=${encodeURIComponent(id)}`)
                                                }
                                            />
                                        ))}
                                    </section>
                                ),
                        )
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
