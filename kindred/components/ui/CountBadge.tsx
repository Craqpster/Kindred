// Beyond this the badge shows "9+". A fixed square box can hold two glyphs and stay a
// circle; letting it hold three would force it back into the oval this component exists to
// avoid. Screen readers still get the real number — see the aria note below.
const MAX_SHOWN = 9;

/// A small count in a circle: unread messages, pending requests.
///
/// Built like Avatar rather than as a padded pill. Padding plus a line box gives a width and
/// a height that have no reason to match, so `rounded-full` on that produces a stadium, not a
/// circle. Explicit square dimensions with the fill as its own absolutely-positioned child is
/// what makes the shape independent of the text inside it.
///
/// aria-hidden, again like Avatar: this restates a count the caller is expected to announce
/// itself, and its `sr-only` text should carry the TRUE number rather than the capped one.
export default function CountBadge({
    count,
    size = 20,
    className = "",
    circleClassName = "bg-accent-600",
}: {
    count: number;
    size?: number;
    /// On the root — text colour and any margin.
    className?: string;
    /// On the circle — the fill.
    circleClassName?: string;
}) {
    if (count <= 0) return null;

    const overflowed = count > MAX_SHOWN;

    return (
        <span
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                // Two glyphs have to sit smaller than one to fit the same circle — the same
                // reason Avatar drops to 0.4 for two initials.
                fontSize: Math.round(size * (overflowed ? 0.4 : 0.5)),
            }}
            className={`relative inline-flex shrink-0 items-center justify-center font-semibold leading-none tabular-nums ${className}`}
        >
            <span className={`absolute inset-0 rounded-full ${circleClassName}`} />
            <span className="relative">{overflowed ? `${MAX_SHOWN}+` : count}</span>
        </span>
    );
}
