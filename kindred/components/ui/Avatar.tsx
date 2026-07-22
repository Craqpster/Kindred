import Image from "next/image";

const NAVY_COLORS = [
    "#153d74", // star sapphire
    "#24506e", // deep teal-blue
    "#1f4e82", // deep blue
    "#2b5a8c", // mid blue
];

function initialsOf(name: string): string {
    const parts = name.split(/[\s_-]+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorOf(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return NAVY_COLORS[Math.abs(hash) % NAVY_COLORS.length];
}

export default function Avatar({
    name,
    avatarId,
    avatarSeed,
    size = 40,
    className = "",
}: {
    name: string;
    avatarId?: string | null;
    avatarSeed?: string | null;
    size?: number;
    className?: string;
}) {
    const hasCustomAvatar = avatarId && avatarSeed;

    return (
        <span
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                fontSize: Math.round(size * 0.4),
            }}
            className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-sans leading-none font-semibold text-surface select-none ${className}`}
        >
            {hasCustomAvatar ? (
                <>
                    <span className="absolute inset-0 bg-bone-200" />
                    <Image
                        src={`https://api.dicebear.com/9.x/${avatarId}/svg?seed=${avatarSeed}`}
                        alt={`${name}'s avatar`}
                        width={size}
                        height={size}
                        unoptimized
                        className="relative h-full w-full object-cover"
                    />
                </>
            ) : (
                <>
                    <span
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: colorOf(name) }}
                    />
                    <span className="relative">{initialsOf(name)}</span>
                </>
            )}
        </span>
    );
}