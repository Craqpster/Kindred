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

        // Advancements that belong to the CHANNEL rather than to one person, so everyone
        // watching hears about them. The XP award itself only ever runs for the sender,
        // which is why these have to travel: the daily bonus credits every member and the
        // chat level is a single shared number, but without a broadcast only the person
        // who happened to send the last message would be told.
        //
        // Personal advancement (a +1, a confidence tier) is deliberately NOT here - it is
        // not news to anyone else, and per-message XP would put a toast on every screen
        // for every message.
        chat_level_up: true;
        chat_daily_bonus: true;

        // Sent after a move in a game_sessions game (lib/games.ts), so the other
        // player's open board updates live if they're online right now. Not durable -
        // useGameSync.ts treats Postgres, loaded on mount, as the real source of truth
        // and this event only as a low-latency nudge to refetch/update sooner.
        game_state: true;
    }

    // Stream builds Event as `CustomEventData & {...}`, so anything declared here is
    // available (and typed) on the events above.
    interface CustomEventData {
        // From channel XP/leveling
        chatLevel?: number;
        bonusXp?: number;
        
        // From turn-based games. sessionId identifies which game_sessions row this event
        // is about; gameState is that game's own state shape (TicTacToeState, ConnectFourState, ...) 
        // - each game's Board component narrows it itself.
        sessionId?: string;
        gameState?: unknown;
    }

    // Marks a message as an icebreaker prompt card (posted by the Kindred bot user,
    // see lib/prompts.ts) or as someone's reply to one (tagged by IcebreakerCard.tsx
    // when sent). Both are load-bearing beyond rendering: IcebreakerCard groups replies
    // under their prompt by promptId, ChatMessage suppresses the loose bubble for a reply
    // it has grouped, and lib/confidence.ts reads both fields back off Stream to verify a
    // reply before granting it guaranteed XP.
    //
    // Also marks group game invites (GameControllerBar.tsx, first-come-first-served
    // like a GamePigeon invite - see GameInviteCard.tsx).
    //
    // gameSessionId is unset while a game_invite is still open (nobody has joined yet)
    // and set once someone does - /api/games/join sets it (and gameJoinerId) via
    // partialUpdateMessage, which is what turns the card from "Join" into "Open" for
    // everyone watching the channel in real time.
    interface CustomMessageData {
        messageType?: "icebreaker_prompt" | "prompt_response" | "game_invite";
        promptId?: string;
        gameType?: string;
        gameSessionId?: string;
        gameJoinerId?: string;
    }
}