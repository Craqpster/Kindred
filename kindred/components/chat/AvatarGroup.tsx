import Avatar from "@/components/ui/Avatar";

const MAX_SHOWN = 3;

/// Overlapping circles for the members of a group chat.
///
/// aria-hidden as a whole, not just per Avatar: the faces restate names the card already
/// announces in its heading, and without this the "+N" chip's text leaks to a screen
/// reader as a stray number after the title.
export default function AvatarGroup({ names, size = 32 }: { names: string[]; size?: number }) {
    const shown = names.slice(0, MAX_SHOWN);
    const overflow = names.length - shown.length;

    return (
        <span aria-hidden="true" className="flex shrink-0 items-center">
            {shown.map((name, i) => (
                <Avatar
                    key={name}
                    name={name}
                    size={size}
                    // rounded-full on Avatar's root is load-bearing: that root is a square
                    // inline-flex box with the coloured circle as an absolutely positioned
                    // child, so a ring on it would trace the square, not the circle.
                    // The ring is surface-coloured rather than transparent because it is
                    // the only thing separating two circles that hashed to neighbouring
                    // palette entries.
                    className={`rounded-full ring-2 ring-surface ${i > 0 ? "-ml-2" : ""}`}
                />
            ))}

            {overflow > 0 && (
                <span
                    style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
                    className="-ml-2 inline-flex shrink-0 items-center justify-center rounded-full bg-bone-200 font-semibold text-ink-600 ring-2 ring-surface"
                >
                    +{overflow}
                </span>
            )}
        </span>
    );
}