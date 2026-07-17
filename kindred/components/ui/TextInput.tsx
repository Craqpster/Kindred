type TextInputProps = React.ComponentPropsWithoutRef<"input">;

export default function TextInput({ className = "", ...props }: TextInputProps) {
    return (
        <input
            {...props}
            className={`w-full px-4 py-2.5 rounded-lg border border-metro-blue bg-white text-ink transition outline-none focus:border-star-sapphire focus:ring-2 focus:ring-star-sapphire/30 aria-[invalid]:border-red-700 aria-[invalid]:focus:ring-red-700/30 ${className}`}
        />
    );
}