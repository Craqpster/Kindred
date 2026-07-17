// Owns the accessibility contract for a form control: the label points at the input,
// the input points back at its hint and error, and the error is announced when it
// appears after a submit.
//
// Children is a render function rather than plain nodes so the wiring cannot be
// forgotten — the only way to render a control here is to spread the props it hands
// you. Across the auth and onboarding forms there are ~10 controls; typing this by
// hand ten times is how one of them ends up unlabelled.

type FieldAria = {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
};

type FieldProps = {
    id: string;
    label: string;
    hint?: string;
    /// Field errors as zod returns them: z.flattenError(err).fieldErrors[name]
    error?: string[];
    children: (aria: FieldAria) => React.ReactNode;
};

export default function Field({ id, label, hint, error, children }: FieldProps) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error?.length ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="font-medium text-star-sapphire">
                {label}
            </label>

            {hint && (
                <p id={hintId} className="text-sm text-gray-600">
                    {hint}
                </p>
            )}

            {children({
                id,
                "aria-describedby": describedBy,
                "aria-invalid": error?.length ? true : undefined,
            })}

            {/* aria-live so the message is announced when validation comes back,
                not silently painted in. */}
            <p id={errorId} role="alert" aria-live="polite" className="text-sm text-red-700 empty:hidden">
                {error?.[0]}
            </p>
        </div>
    );
}
