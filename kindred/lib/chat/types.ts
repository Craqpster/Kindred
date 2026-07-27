// What the chat UI is allowed to see.
//
// Deliberately not the Prisma rows. A message row carries conversation_id, parent_id and a
// sender uuid; a message *card* needs a name and an avatar. Translating once here means no
// component ever holds a database row, and the realtime layer has a single shape to patch
// into rather than a different one per screen.
//
// This file is imported by client components, so it must stay types-only — no imports that
// drag server code across the boundary.

/// Mirrors the conversations_kind_check constraint.
export type ConversationKind = "dm" | "group";

/// Mirrors the messages_kind_check constraint. Adding one means changing the constraint
/// (a migration), this union, and whatever renders it — in that order.
export type MessageKind = "text" | "icebreaker_prompt" | "prompt_response" | "game_invite";

/// A person, as any chat surface needs them. Avatars are ids and seeds rather than URLs
/// because Dicebear builds the URL in the browser — see components/ui/Avatar.tsx.
export type ChatMember = {
    id: string;
    username: string;
    avatarId: string | null;
    avatarSeed: string | null;
};

/// One emoji and everyone who picked it, already grouped — the UI wants "👍 3", never a
/// flat list it has to tally on every render.
export type MessageReaction = {
    emoji: string;
    /// Profile ids, so a card can tell "you reacted" from "someone did" without a second
    /// pass over the data.
    reactedBy: string[];
};

/// Timestamps are ISO strings throughout, NOT Date objects.
///
/// A message reaches the client two ways: rendered by a server component, or pushed as a
/// Supabase realtime payload — and realtime hands over raw JSON, where a timestamp is
/// always a string. Making the server path match means one shape, so a pushed row can be
/// dropped straight into state next to a loaded one with nothing to normalise between them.
export type ChatMessage = {
    id: string;
    conversationId: string;
    kind: MessageKind;
    body: string;
    /// null means the Kindred bot posted it.
    sender: ChatMember | null;
    /// The quoted message, flattened to what a quote block shows. Absent if the quoted
    /// message was deleted.
    replyTo: { id: string; body: string; senderName: string | null } | null;
    /// prompt_response only — which icebreaker this answers.
    promptId: string | null;
    /// Non-null means this lives in a thread rather than the main timeline.
    parentId: string | null;
    /// How many replies hang off this message. Always 0 for a message that is itself a
    /// reply, since threads are one level deep.
    replyCount: number;
    /// game_invite only.
    gameType: string | null;
    reactions: MessageReaction[];
    createdAt: string;
    editedAt: string | null;
    deletedAt: string | null;
    pinnedAt: string | null;
};

/// One row in the chat list, and the header of an open conversation.
export type ChatConversation = {
    id: string;
    kind: ConversationKind;
    /// Already resolved: a group's own title, or — for a DM — the other person's username.
    /// Resolved on the server because it depends on who is asking, which is exactly the
    /// kind of thing a component should not have to work out.
    title: string;
    /// Everyone except the viewer. A DM has one; a group has two or three.
    others: ChatMember[];
    lastMessageAt: string | null;
    /// Enough to draw the list row without loading the conversation.
    preview: string | null;
    unreadCount: number;
    /// Someone waved and nobody has replied yet — the Pending tab is exactly these.
    pending: boolean;
    /// True when the viewer is the one being waved AT, so the UI can say "wants to say hi"
    /// rather than "waiting on a reply".
    awaitingYou: boolean;
    /// When each OTHER member last read this conversation, keyed by profile id.
    ///
    /// A message counts as read by someone when their timestamp here is newer than it. That
    /// makes a read receipt a comparison rather than a per-message table — one row per
    /// member instead of one row per message per member, which is the difference between a
    /// column and a write on every scroll.
    readBy: Record<string, string>;
};

/// How warmed up one conversation is, and how close it is to today's bonus.
///
/// The level fields are derived from `xp` rather than stored, so there is one definition of
/// what a level costs (lib/chat-level.ts) instead of a column that can disagree with it.
export type ConversationXp = {
    /// Shared by everyone in the conversation — this is not a per-person score.
    xp: number;
    level: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    /// The VIEWER's own qualifying messages today, not the room's total. The bonus needs
    /// everybody, but "how am I doing" is the only part worth showing one person, and it
    /// avoids reporting other members' activity to them.
    messagesToday: number;
    /// How many each member has to send today for the conversation to earn its bonus.
    bonusThreshold: number;
    /// Already claimed today, so the meter is done rather than merely full.
    bonusEarnedToday: boolean;
    /// What that bonus paid, or null if it has not been earned today. Carried so the toast
    /// can name the figure whether it was this client that triggered it or another.
    bonusXpToday: number | null;
};

/// A message on its way out, before the server has confirmed it.
///
/// Only ever exists in the composer's own optimistic copy: `sending` becomes `sent` when the
/// action returns, and there is no `delivered` because a browser has nothing to acknowledge
/// delivery with. Whether the other person is actually there is presence, and says so.
export type MessageStatus = "sending" | "sent" | "failed";

/// What the timeline holds: the server's message, plus how far along it is if this client is
/// the one sending it. Anything loaded from the server is simply `sent`.
export type TimelineMessage = ChatMessage & { status?: MessageStatus };

/// A page of messages, oldest-first the way a timeline reads.
export type MessagePage = {
    messages: ChatMessage[];
    /// Pass back as `before` to load the page above this one. null when the top has been
    /// reached, which is what stops an infinite scroll from asking forever.
    nextCursor: string | null;
};
