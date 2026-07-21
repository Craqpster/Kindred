import type { ToastInput } from "@/components/ui/ToastStack";

/// Toasts for advancements that belong to the whole channel.
///
/// Defined once because they are raised from two places: locally by the sender in
/// useModeratedSend, and from a broadcast channel event by everyone else. Two copies of
/// the wording would drift, and the person who happened to send the message would end up
/// reading something subtly different from everyone who received it.

export function chatLevelToast(level: number): ToastInput {
    return {
        kind: "milestone",
        title: `Chat Level ${level}`,
        body: "This conversation levelled up.",
        // Keyed so a level-up cannot arrive twice - once locally and once echoed back
        // from Stream - and stack as two identical toasts.
        mergeKey: `chat-level:${level}`,
    };
}

export function dailyBonusToast(xp: number): ToastInput {
    return {
        kind: "milestone",
        title: `+${xp} XP · Daily bonus`,
        // Deliberately not "you both": this fires in groups too, where it took everyone.
        body: "Everyone showed up today.",
        mergeKey: "daily-bonus",
    };
}
