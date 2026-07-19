"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useSyncExternalStore } from "react";

// Colours follow components/homepage/LandingHero.tsx:16 (primary) and :23 (secondary),
// so the auth and onboarding forms match the landing page.
//
// Pill-shaped and flat: the shadow that LandingHero's own buttons carry is deliberately
// not repeated here. Shared by /login, /signup, the onboarding wizard and match cards.
//
// Press/hover springs follow beui's motion button, with one deviation: hover scales
// non-uniformly, so the button stretches wider than it grows tall.


type ButtonProps = HTMLMotionProps<"button"> & {
    variant?: "primary" | "secondary";
    size?: "sm" | "md" | "icon";
};

const VARIANTS = {
    primary: "bg-star-sapphire text-white hover:bg-star-sapphire/90",
    secondary: "border border-star-sapphire text-star-sapphire hover:bg-mist",
} as const;

const SIZES = {
    md: "px-6 py-3",
    sm: "px-4 py-2 text-sm",
    icon: "p-2.5",
} as const;

const SPRING = { type: "spring", stiffness: 500, damping: 30, mass: 0.6 } as const;

const HOVER_QUERY = "(hover: hover)";

function useHoverCapable() {
    return useSyncExternalStore(
        (onStoreChange) => {
            const query = window.matchMedia(HOVER_QUERY);
            query.addEventListener("change", onStoreChange);
            return () => query.removeEventListener("change", onStoreChange);
        },
        () => window.matchMedia(HOVER_QUERY).matches,
        () => false,
    );
}

export default function Button({
    variant = "primary",
    size = "md",
    className = "",
    ...props
}: ButtonProps) {
    const reduceMotion = useReducedMotion();
    const canHover = useHoverCapable();

    return (
        <motion.button
            {...props}
            whileHover={reduceMotion || !canHover ? undefined : { scaleX: 1.05, scaleY: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.93 }}
            transition={SPRING}
            className={`inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
        />
    );
}