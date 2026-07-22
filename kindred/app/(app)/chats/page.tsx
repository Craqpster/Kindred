import ChatClient from "@/components/chat/ChatClient";
import type { ChatTab } from "@/components/chat/ChatTabs";
import { requireProfile } from "@/lib/dal";
import { streamServerClient } from "@/lib/stream";

export default async function ChatsPage({
    searchParams,
}: {
    searchParams: Promise<{ c?: string; type?: string; greet?: string }>;
}) {
    const [profile, { c, type, greet }] = await Promise.all([
        requireProfile(),
        searchParams,
    ]);

    const channelType = type === "team" ? "team" : "messaging";
    const initialTab = c ? await tabFor(channelType, c) : "active";

    return (
        /* Full height, borderless, strictly scoped inner scrolling next to AppDock */
        <div className="flex h-full w-full items-center justify-center p-0 sm:pl-24">
            <div className="flex h-full w-full overflow-hidden bg-bone-100">
                <ChatClient
                    userId={profile.id}
                    openChannelId={c}
                    openChannelType={channelType}
                    greet={greet === "1"}
                    initialTab={initialTab}
                />
            </div>
        </div>
    );
}

async function tabFor(type: "messaging" | "team", id: string): Promise<ChatTab> {
    const [channel] = await streamServerClient.queryChannels({ type, id });
    return channel?.data?.requested_of ? "pending" : "active";
}