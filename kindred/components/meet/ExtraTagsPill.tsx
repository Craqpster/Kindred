"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

// The "+N" chip on a match card. Clicking it expands in place: the chip itself becomes
// the remaining tags, wrapping inside the card. Clicking again collapses it.
//
// The chip wears the same pill style as the tags it hides, so "+3" visibly IS three tags
// folded up rather than a different kind of object.
export default function ExtraTagsPill({ tags }: { tags: readonly string[] }) {
    const [open, setOpen] = useState(false);
    const reduceMotion = useReducedMotion();

    if (tags.length === 0) return null;

    const transition = reduceMotion
        ? { duration: 0 }
        : ({ type: "spring", stiffness: 500, damping: 30, mass: 0.6 } as const);

    return (
        <motion.button
            type="button"
            // layout animates the size change itself, since the element genuinely grows
            // rather than a separate layer fading in.
            layout
            transition={transition}
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            // Only while collapsed: screen readers get the hidden tags without having to
            // expand. Once open the tags are real visible text, and an aria-label here
            // would override them instead of letting them be read.
            aria-label={open ? undefined : `Show ${tags.length} more: ${tags.join(", ")}`}
            className={`flex cursor-pointer flex-wrap items-center gap-1.5 transition-colors ${
                open
                    ? "rounded-2xl bg-bone-100 p-1.5"
                    : "rounded-full bg-accent-50 px-3 py-1.5 text-meta font-medium text-accent-700 hover:bg-accent-100"
            }`}
        >
            <AnimatePresence mode="popLayout" initial={false}>
                {open ? (
                    tags.map((tag) => (
                        <motion.span
                            key={tag}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={transition}
                            className="rounded-full bg-accent-50 px-3 py-1.5 text-meta font-medium text-accent-700"
                        >
                            {tag}
                        </motion.span>
                    ))
                ) : (
                    <motion.span
                        key="count"
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={transition}
                    >
                        +{tags.length}
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    );
}