type TextInputProps = React.ComponentPropsWithoutRef<"input">;

export default function TextInput({ className = "", ...props }: TextInputProps) {
    return (
        <input
            {...props}
            className={`w-full px-4 py-2.5 rounded-lg border border-[#3F79AF] bg-white text-[#1A1A1A] transition outline-none focus:border-[#153D74] focus:ring-2 focus:ring-[#153D74]/30 aria-[invalid]:border-red-700 aria-[invalid]:focus:ring-red-700/30 ${className}`}
        />
    );
}