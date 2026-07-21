import ExtraTagsPill from "@/components/meet/ExtraTagsPill";


export default function MatchTags({
    tags,
    max,
    label,
}: {
    tags: readonly string[];
    max: number;
    label?: string;
}) {
    if (tags.length === 0) return null;

    const shown = tags.slice(0, max);
    const extra = tags.slice(max);

    return (
        <div className="flex flex-col gap-2">
            {label ? <p className="text-label text-ink-600 uppercase">{label}</p> : null}

            <div className="flex flex-wrap items-center gap-1.5">
                {shown.map((tag) => (
                    <span
                        key={tag}
                        className="rounded-full bg-accent-50 px-3 py-1.5 text-meta font-medium text-accent-700"
                    >
                        {tag}
                    </span>
                ))}
                <ExtraTagsPill tags={extra} />
            </div>
        </div>
    );
}