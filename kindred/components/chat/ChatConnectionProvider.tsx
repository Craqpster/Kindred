"use client";

import { useCallback, useEffect } from "react";
import type { Event } from "stream-chat";
import { Chat, useCreateChatClient } from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import { useToast } from "@/components/ui/ToastStack";
import { KINDRED_BOT_ID } from "@/lib/kindred-bot";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;

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

    const { showToast } = useToast();

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

            // Icebreakers are posted by the bot, not by either person, so the "is this
            // mine?" check above never caught them - which is why asking for a prompt
            // toasted your own request back at you as "Kindred: ...". The card in the
            // timeline announces a prompt far better than a toast can anyway.
            if (
                message.user?.id === KINDRED_BOT_ID ||
                message.messageType === "icebreaker_prompt"
            ) {
                return;
            }

            // An answer is announced WITHOUT its text. IcebreakerCard deliberately keeps
            // other people's answers out of the DOM until you have written your own, and
            // putting the text in a toast would hand it over anyway - the notification
            // would quietly undo the whole mechanism.
            const isAnswer = message.messageType === "prompt_response";
            const name = message.user?.name ?? "Someone";

            // Merged per sender, not per message: several messages arriving in a row from
            // one person is one event to the reader, and stacking a toast for each buries
            // everything else. The newest text wins.
            showToast({
                kind: "message",
                title: isAnswer ? `${name} answered the icebreaker` : name,
                body: isAnswer ? undefined : (message.text ?? ""),
                mergeKey: `message:${message.user?.id ?? "unknown"}`,
            });
        };

        client.on("notification.message_new", handleNewMessage);
        client.on("message.new", handleNewMessage);
        return () => {
            client.off("notification.message_new", handleNewMessage);
            client.off("message.new", handleNewMessage);
        };
    }, [client, userId, showToast]);

    if (!client) {
        return (
            <div className="flex flex-1 items-center justify-center p-8 text-meta text-ink-600">
                Connecting to chat...
            </div>
        );
    }

    return (
        <Chat client={client} theme="str-chat__theme-light">
            {children}
        </Chat>
    );
}
