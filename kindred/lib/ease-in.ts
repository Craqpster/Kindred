// Phrasing for the onboarding ease_in value, used in "why you matched" when two people
// picked the same one. Keep these as sentence fragments that follow "you both ".

const PHRASES: Record<string, string> = {
    openers: "like a hand starting conversations",
    gradual: "prefer easing into groups",
    volume: "just want to meet more people",
};

export function easeInPhrase(value: string | null | undefined): string | null {
    if (!value) return null;
    return PHRASES[value] ?? null;
}
