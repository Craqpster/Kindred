"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

// The "+N" chip on a match card. Hovering or focusing it springs a popover open with the
// tags that did not fit.
//
// A <button type="button">, not a <span>: it has to be focusable so keyboard users can
// reach the hidden tags, and the explicit type matters because a bare <button> defaults
// to submit and this sits in a card beside the Say hi form.
export default function ExtraTagsPill({ tags }: { tags: readonly string[] }) {
    const [open, setOpen] = useState(false);
    const reduceMotion = useReducedMotion();

    if (tags.length === 0) return null;

    return (
        <span className="relative inline-flex">
            <button
                type="button"
                // Names the hidden content for screen readers, which never see the
                // popover — it is decorative and marked aria-hidden below.
                aria-label={`${tags.length} more: ${tags.join(", ")}`}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                className="cursor-default rounded-full bg-iceland/10 px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-iceland/20"
            >
                +{tags.length}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.span
                        aria-hidden="true"
                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 4 }}
                        transition={
                            reduceMotion
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 500, damping: 30, mass: 0.6 }
                        }
                        // bottom-full so it opens upward, clear of the card's action row.
                        // The card has no overflow-hidden, so this is not clipped.
                        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 flex gap-1 rounded-xl border border-white/60 bg-white/80 px-2 py-1.5 whitespace-nowrap shadow-sm backdrop-blur-xl"
                    >
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-iceland/10 px-2 py-0.5 text-xs text-star-sapphire"
                            >
                                {tag}
                            </span>
                        ))}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}