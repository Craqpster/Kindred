// A soft tint per tag, picked deterministically from the tag's name.
//
// The point is that the shared interests are the visual subject of a match card, not
// metadata: the card's colour comes from what two people have in common. Hashing the
// name (rather than the index) means "Hiking" is the same colour on every card and for
// every viewer, so the tags read as stable labels instead of decoration.
//
// Same approach as components/ui/Avatar.tsx, which hashes the handle.
//
// No pink or purple in the set: pink reads romantic, and purple reads as Discord.

export type TagTint = {
    bg: string;
    text: string;
};

const TINTS: readonly TagTint[] = [
    { bg: "#edf7d4", text: "#4f6b14" }, // lime
    { bg: "#ddf0ec", text: "#1b5f55" }, // teal
    { bg: "#fbf0d5", text: "#8a6512" }, // amber
    { bg: "#e3eff9", text: "#245d82" }, // sky
    { bg: "#f7e9e1", text: "#8c4f32" }, // clay
    { bg: "#e8efe4", text: "#46603a" }, // sage
];

export function tintFor(tag: string): TagTint {
    let hash = 0;
    for (let i = 0; i < tag.length; i += 1) {
        hash = (hash * 31 + tag.charCodeAt(i)) | 0;
    }
    return TINTS[Math.abs(hash) % TINTS.length];
}