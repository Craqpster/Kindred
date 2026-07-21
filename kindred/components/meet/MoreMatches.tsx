"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

// Everyone past the first three, behind one control.
//
// This is Meet's only way to move past someone, and that is the point: there is no
// per-person dismiss. Nobody is ever asked to reject an individual — they just ask to
// see more people.
export default function MoreMatches({
    count,
    children,
}: {
    count: number;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const reduceMotion = useReducedMotion();
    const regionId = useId();

    if (count === 0) return null;

    const transition = reduceMotion
        ? { duration: 0 }
        : ({ type: "spring", stiffness: 500, damping: 30, mass: 0.6 } as const);

    return (
        <div className="mt-6 flex flex-col items-center gap-4">
            <AnimatePresence initial={false}>
                {open ? (
                    <motion.div
                        key="rest"
                        id={regionId}
                        // The region genuinely grows, so animate its height rather than
                        // fading a fixed-size layer in — same reasoning as ExtraTagsPill.
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={transition}
                        className="w-full overflow-hidden"
                    >
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {/* layout so the button springs down as the region above it opens, instead
                of jumping to its new position. */}
            <motion.button
                type="button"
                layout
                transition={transition}
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                // Only while open: the region is unmounted when collapsed, and pointing
                // aria-controls at an id that is not in the document is a dangling
                // reference. aria-expanded is what carries the state either way.
                aria-controls={open ? regionId : undefined}
                className="flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-meta font-medium text-ink-600 transition-colors hover:bg-bone-200 hover:text-ink-900"
            >
                {open ? "Show fewer" : `Show ${count} more ${count === 1 ? "person" : "people"}`}
                <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={transition}
                    className="flex"
                >
                    <ChevronDown size={16} aria-hidden />
                </motion.span>
            </motion.button>
        </div>
    );
}