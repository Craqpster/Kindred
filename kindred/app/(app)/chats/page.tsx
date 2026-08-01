import ChatClient from "@/components/chat/ChatClient";
import type { ChatTab } from "@/components/chat/ChatTabs";
import { getConversation, getConversationXp, getMessages } from "@/lib/chat/queries";
import { requireProfile } from "@/lib/dal";

export default async function ChatsPage({
    searchParams,
}: {
    // No `type` any more: a Stream channel id was only unique within its type, so every link
    // had to carry one. A conversation id is a uuid and identifies a conversation on its own.
    searchParams: Promise<{ c?: string; greet?: string }>;
}) {
    const [profile, { c, greet }] = await Promise.all([requireProfile(), searchParams]);

    // Both reads are membership-scoped, so an id someone typed into the URL resolves to an
    // empty pane rather than to somebody else's conversation. Prisma bypasses RLS, which
    // makes this the gate rather than a second line of defence.
    const conversation = c
        ? await getConversation({ conversationId: c, userId: profile.id })
        : null;

    // The first page of history and the XP badge are both rendered on the server, so the
    // timeline and the level are on screen at first paint instead of appearing after a
    // client round trip. Requested together because neither depends on the other.
    const [page, xp] = conversation
        ? await Promise.all([
              getMessages({ conversationId: conversation.id, userId: profile.id }),
              getConversationXp({ conversationId: conversation.id, userId: profile.id }),
          ])
        : [{ messages: [], nextCursor: null }, null];

    // Which tab opens is read off the conversation we already loaded. This used to be a
    // second query to Stream on every page load, asking it the same question.
    const initialTab: ChatTab = conversation?.awaitingYou ? "pending" : "active";

    return (
        /* Full height, borderless, strictly scoped inner scrolling next to AppDock */
        <div className="flex h-full w-full items-center justify-center p-0 sm:pl-24">
            <div className="flex h-full w-full overflow-hidden bg-bone-100">
                <ChatClient
                    userId={profile.id}
                    openConversationId={conversation?.id}
                    initialMessages={page.messages}
                    initialXp={xp}
                    greet={greet === "1"}
                    initialTab={initialTab}
                />
            </div>
        </div>
    );
}
