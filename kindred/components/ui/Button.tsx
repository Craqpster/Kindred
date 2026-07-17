// Colours follow components/homepage/LandingHero.tsx:16 (primary) and :23 (secondary),
// so the auth and onboarding forms match the landing page.
//
// Pill-shaped and flat: the shadow that LandingHero's own buttons carry is deliberately
// not repeated here. Shared by /login, /signup and the onboarding wizard.

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
    variant?: "primary" | "secondary";
};

const VARIANTS = {
    primary: "bg-star-sapphire text-white hover:bg-star-sapphire/90",
    secondary: "border border-star-sapphire text-star-sapphire hover:bg-mist",
} as const;

export default function Button({
    variant = "primary",
    className = "",
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            className={`px-6 py-3 rounded-full font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
        />
    );
}
