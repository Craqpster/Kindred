"use client";

import { ReactNode } from "react";
import ChatConnectionProvider from "./ChatConnectionProvider";

type Profile = {
    id: string;
    username: string;
    // add any other fields you need
};

export default function ChatProviderWrapper({
    profile,
    children,
}: {
    profile: Profile;
    children: ReactNode;
}) {
    return (
        <ChatConnectionProvider userId={profile.id} username={profile.username}>
            {children}
        </ChatConnectionProvider>
    );
}