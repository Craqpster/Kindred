"use client";

import { ReactNode } from "react";

import ChatRealtimeProvider from "@/components/chat/ChatRealtimeProvider";
import { ToastProvider } from "@/components/ui/ToastStack";
import type { ChatConversation } from "@/lib/chat/types";

/// Wraps the whole authenticated shell.
///
/// The chat subscription lives up here rather than on /chats because unread badges and
/// new-message toasts have to keep working from /meet and /me. That was true of Stream's
/// connection too, and moving it down is what made the old one racy.
export default function AppProviders({
    userId,
    conversations,
    children,
}: {
    userId: string;
    conversations: ChatConversation[];
    children: ReactNode;
}) {
    return (
        <ToastProvider>
            <ChatRealtimeProvider userId={userId} initialConversations={conversations}>
                {children}
            </ChatRealtimeProvider>
        </ToastProvider>
    );
}
