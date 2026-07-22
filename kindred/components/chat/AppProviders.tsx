"use client";

import { ReactNode } from "react";
import ChatConnectionProvider from "./ChatConnectionProvider";
import { ToastProvider } from "@/components/ui/ToastStack";

type Profile = {
    id: string;           
    username: string;
    avatar_id?: string | null;
    avatar_seed?: string | null;
};

export default function AppProviders({
    profile,
    children,
}: {
    profile: Profile;
    children: ReactNode;
}) {
    return (
        <ToastProvider>
            <ChatConnectionProvider
                userId={profile.id}
                username={profile.username}
            >
                {children}
            </ChatConnectionProvider>
        </ToastProvider>
    );
}