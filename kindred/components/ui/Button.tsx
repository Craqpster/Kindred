// Class strings lifted verbatim from components/homepage/LandingHero.tsx:16 (primary)
// and :23 (secondary) so the auth and onboarding forms match the landing page exactly.

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
    variant?: "primary" | "secondary";
};

const VARIANTS = {
    primary: "bg-[#153D74] text-white shadow-md hover:shadow-lg",
    secondary: "border border-[#153D74] text-[#153D74] hover:bg-[#EEF0FF]",
} as const;

export default function Button({
    variant = "primary",
    className = "",
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            className={`px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
        />
    );
}
