// Stream's EventTypes union is closed over CustomEventTypes, which ships empty on
// purpose for apps to extend. "chat_xp_updated" is sent after a message earns channel
// XP (lib/confidence.ts), so the badge in ChatClient.tsx can refetch right when the
// award actually lands instead of racing it. Underscores, not dots - Stream rejects
// custom event type names containing a "." at the API level.
//
// The empty export is required - without it, this file has no top-level import/export
// and TypeScript treats it as a global script, so "declare module" REPLACES stream-chat's
// real types instead of merging with them.
export {};

declare module "stream-chat" {
    interface CustomEventTypes {
        chat_xp_updated: true;
    }

    // Marks a message as an icebreaker prompt card (posted by the Kindred bot user,
    // see lib/prompts.ts) or as someone's reply to one (tagged client-side in
    // ChatClient.tsx when sent). ChatClient.tsx's custom Message renderer reads this to
    // render each kind differently; lib/confidence.ts's /api/confidence caller reads
    // promptId's presence to guarantee XP even for a short reply.
    interface CustomMessageData {
        messageType?: "icebreaker_prompt" | "prompt_response";
        promptId?: string;
    }
}
