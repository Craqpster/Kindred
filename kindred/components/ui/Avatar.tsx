// Deterministic initials avatar. No image, no upload, no avatar_id — the handle alone
// decides the letters and the colour, so the same person always looks the same.
//
// This is the placeholder while real avatars are deferred. When avatar_id gains an
// image, this stays as the fallback for anyone who hasn't picked one.

const COLORS = [
    "#153d74", // star sapphire  — 10.23:1
    "#24506e", // deep teal-blue —  8.16:1
    "#1f4e82", // deep           —  8.08:1
    "#2b5a8c", // mid            —  6.78:1
    "#35648f", // slate blue     —  5.92:1
    "#4c6e9c", // light          —  4.97:1
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
            className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-surface select-none ${className}`}
        >
            {initialsOf(name)}
        </span>
    );
}