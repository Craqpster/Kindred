"use client";

import { useCallback, useEffect, useState } from "react";
import type { Event } from "stream-chat";
import { Chat, useCreateChatClient } from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import Avatar from "@/components/ui/Avatar";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;

type Toast = { id: string; senderName: string; text: string };

const TOAST_DURATION_MS = 5000;

// Connects once for the whole authenticated shell, instead of ChatClient connecting
// once per visit to /chats. Reconnecting on every tab switch was racy: a Stream
// request still in flight from the old connection could resolve just after
// disconnect and throw "You can't use a channel after client.disconnect() was
// called." Connecting once here also means the new-message toast below (and any
// future unread-messages badge) works from any tab, not just while /chats is open.
export default function ChatConnectionProvider({
    userId,
    username,
    children,
}: {
    userId: string;
    username: string;
    children: React.ReactNode;
}) {
    const tokenOrProvider = useCallback(async () => {
        const res = await fetch("/api/stream-token");
        if (!res.ok) {
            throw new Error("Failed to fetch Stream token");
        }
        const data = await res.json();
        return data.token as string;
    }, []);

    const client = useCreateChatClient({
        apiKey,
        tokenOrProvider,
        userData: { id: userId, name: username },
    });

    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        if (!client) return;

        // Stream sends message.new for a channel currently being *watched*
        // (ChannelList/Channel do this automatically, only while /chats is mounted)
        // and notification.message_new for channels the user is a *member* of but not
        // watching. Since the connection now persists across tabs (see the comment at
        // the top of this file), a channel visited once stays watched for the rest of
        // the session - so relying on notification.message_new alone went silent for
        // any channel already opened, which is exactly why nothing fired while on
        // /meet after having been on /chats. Listening for both covers either state.
        const handleNewMessage = (event: Event) => {
            const message = event.message;
            if (!message || message.user?.id === userId) return;

            const toast: Toast = {
                id: message.id,
                senderName: message.user?.name ?? "Someone",
                text: message.text ?? "",
            };
            setToasts((current) =>
                current.some((t) => t.id === toast.id) ? current : [...current, toast],
            );
            setTimeout(() => {
                setToasts((current) => current.filter((t) => t.id !== toast.id));
            }, TOAST_DURATION_MS);
        };

        client.on("notification.message_new", handleNewMessage);
        client.on("message.new", handleNewMessage);
        return () => {
            client.off("notification.message_new", handleNewMessage);
            client.off("message.new", handleNewMessage);
        };
    }, [client, userId]);

    if (!client) {
        return (
            <div className="flex flex-1 items-center justify-center p-8 text-star-sapphire">
                Connecting to chat...
            </div>
        );
    }

    return (
        <Chat client={client} theme="str-chat__theme-light">
            {children}
            <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className="pointer-events-auto flex w-72 items-start gap-3 rounded-lg border border-metro-blue/20 bg-white p-3 shadow-lg"
                    >
                        <Avatar name={toast.senderName} size={36} />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-star-sapphire">{toast.senderName}</p>
                            <p className="truncate text-sm text-gray-600">{toast.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </Chat>
    );
}
