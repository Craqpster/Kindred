// Deterministic initials avatar. No image, no upload, no avatar_id — the handle alone
// decides the letters and the colour, so the same person always looks the same.
//
// This is the placeholder while real avatars are deferred. When avatar_id gains an
// image, this stays as the fallback for anyone who hasn't picked one.

// Palette tints from the brand colours (globals.css @theme). Text is white on all of
// them, so every combination stays legible.
const COLORS = [
    "#153D74", // star sapphire
    "#3F79AF", // metro blue
    "#689CD5", // iceland
    "#2B5A8C",
    "#4C6E9C",
    "#1F4E82",
];

function initialsOf(name: string): string {
    const parts = name.split(/[\s_-]+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorOf(name: string): string {
    // Small stable string hash -> palette index.
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({
    name,
    size = 40,
    className = "",
}: {
    name: string;
    size?: number;
    className?: string;
}) {
    return (
        <span
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                backgroundColor: colorOf(name),
                fontSize: size * 0.4,
            }}
            className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none ${className}`}
        >
            {initialsOf(name)}
        </span>
    );
}