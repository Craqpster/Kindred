import { setMeetView } from "@/app/(app)/meet/actions";
import type { MeetView } from "@/lib/meet-view";

const OPTIONS: readonly { value: MeetView; label: string }[] = [
    { value: "spotlight", label: "Spotlight" },
    { value: "grid", label: "Grid" },
];

export default function ViewToggle({ view }: { view: MeetView }) {
    return (
        <form
            action={setMeetView}
            // A mode switch, not navigation: aria-pressed on each button, rather than
            // aria-current or a radiogroup.
            className="flex items-center gap-0.5 rounded-full border border-bone-300 bg-bone-100 p-0.5"
        >
            {OPTIONS.map(({ value, label }) => {
                const active = view === value;

                return (
                    <button
                        key={value}
                        type="submit"
                        name="view"
                        value={value}
                        aria-pressed={active}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-meta font-medium transition-colors ${
                            active
                                ? "bg-surface text-ink-900 shadow-card"
                                : "text-ink-600 hover:text-ink-900"
                        }`}
                    >
                        {label}
                    </button>
                );
            })}
        </form>
    );
}