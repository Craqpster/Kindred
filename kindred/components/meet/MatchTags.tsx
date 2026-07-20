import ExtraTagsPill from "@/components/meet/ExtraTagsPill";
import { tintFor } from "@/lib/tag-colors";

// A labelled row of tag pills with a "+N" overflow chip. Shared by the compact match
// card and the spotlight, which differ only in how many pills they show and whether the
// tags are the point.
//
// `tone` is the real distinction, not a size:
//   tinted — the shared tags, coloured by tintFor(). These are the subject of the card.
//   muted  — the other person's remaining tags. Deliberately colourless, because tinting
//            them would put them in visual competition with the overlap that actually
//            explains the match.
type Tone = "tinted" | "muted";

export default function MatchTags({
    tags,
    max,
    label,
    tone = "tinted",
}: {
    tags: readonly string[];
    max: number;
    label?: string;
    tone?: Tone;
}) {
    if (tags.length === 0) return null;

    const shown = tags.slice(0, max);
    const extra = tags.slice(max);

    return (
        <div className="flex flex-col gap-2.5">
            {label ? <p className="text-[11px] tracking-wide text-muted">{label}</p> : null}

            <div className="flex flex-wrap items-center gap-1.5">
                {shown.map((tag) => {
                    // Only the tinted tone reads a colour; muted pills share one flat
                    // style so they stay quiet as a group.
                    const tint = tone === "tinted" ? tintFor(tag) : null;

                    return (
                        <span
                            key={tag}
                            style={tint ? { backgroundColor: tint.bg, color: tint.text } : undefined}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                                tint ? "" : "bg-canvas text-muted"
                            }`}
                        >
                            {tag}
                        </span>
                    );
                })}
                <ExtraTagsPill tags={extra} tone={tone} />
            </div>
        </div>
    );
}