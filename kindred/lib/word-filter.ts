import "server-only";

import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// Built once per server process, not per request. englishDataset ships with real
// slurs and profanity (not just mild words) and englishRecommendedTransformers
// catches common evasion tricks - leetspeak, extra spacing, repeated letters - so
// this isn't just a naive exact-word match.
const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
});

/// Layer 1 of moderation: an instant, free, local check. Catches most common
/// profanity/slurs without ever calling OpenAI.
export function containsBlockedWord(text: string): boolean {
    return matcher.hasMatch(text);
}
