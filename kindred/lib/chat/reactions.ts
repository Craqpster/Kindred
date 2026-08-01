/// The reactions a message can carry.
///
/// A closed set rather than a free emoji field, and shared by both sides on purpose: the
/// picker renders exactly this list and the server action validates against exactly this
/// list, so "what can be reacted with" has one definition instead of two that drift.
///
/// No server imports here — the picker is a client component. Same reason lib/confidence-xp.ts
/// sits outside lib/confidence.ts.
///
/// The set itself follows the project's standing constraint: no ❤️. A heart reads romantic
/// whatever colour it is, and Kindred is deliberately not that. These are all "I saw this and
/// I'm glad you said it", which is the register the app wants.
export const REACTION_EMOJI = ["👍", "😂", "🎉", "👏", "🤔", "🙌"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJI)[number];
