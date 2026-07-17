// A suggested conversation opener for a shared tag. Curated for the twelve onboarding
// starter tags (lib/onboarding-tags.ts); anything else falls back to a generic prompt
// built from the tag name.

const OPENERS: Record<string, string> = {
    "Indie games": "ask what they're playing right now",
    Hiking: "ask about the best trail they've done lately",
    Cooking: "ask what they cooked most recently",
    Anime: "ask what they'd tell a beginner to watch first",
    "Live music": "ask about the last show they went to",
    Photography: "ask what they like pointing a camera at",
    "Board games": "ask what's been hitting the table lately",
    Reading: "ask what they're in the middle of",
    Fitness: "ask what their current routine looks like",
    Film: "ask about a film they'd rewatch any time",
    Coffee: "ask how they take theirs",
    Art: "ask what they've been making or looking at",
};

export function openerFor(tagName: string | undefined): string {
    if (!tagName) return "ask them what they've been up to";
    return OPENERS[tagName] ?? `ask them about ${tagName.toLowerCase()}`;
}