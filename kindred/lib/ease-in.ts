// The onboarding "how do you want to ease in?" answer, and how a match card explains it.

export type EaseIn = "openers" | "gradual" | "volume";

const VALUES: readonly string[] = ["openers", "gradual", "volume"] satisfies EaseIn[];

/// Narrows the untyped column.
export function isEaseIn(value: string | null): value is EaseIn {
    return value !== null && VALUES.includes(value);
}

/// Why two people matched on ease-in, in the second person.
///
/// Deliberately not shared with OnboardingWizard's EASE_IN_OPTIONS: those are written in
/// the first person ("I freeze up starting conversations") because the user is answering
/// about themselves. Here we are describing two people to a third, so the copy has to be
/// rewritten rather than reused.
///
/// Typed Record<EaseIn, string> rather than Record<string, string> so adding a fourth
/// ease_in value fails to compile here instead of silently rendering nothing.
export const EASE_IN_REASON: Record<EaseIn, string> = {
    openers: "You both like a few openers to get started",
    gradual: "You both find one-on-one easier than groups",
    volume: "You both just want more people to talk to",
};