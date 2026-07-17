"use client";

import Link from "next/link";
import { useActionState } from "react";

import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import TextInput from "@/components/ui/TextInput";
import type { AuthState } from "@/app/auth/actions";

type AuthFormProps = {
    action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
    heading: string;
    submitLabel: string;
    passwordHint?: string;
    /// New passwords must not be autofilled with the existing one.
    passwordAutoComplete: "current-password" | "new-password";
    footer: React.ReactNode;
};

const EMPTY: AuthState = {};

export default function AuthForm({
    action,
    heading,
    submitLabel,
    passwordHint,
    passwordAutoComplete,
    footer,
}: AuthFormProps) {
    const [state, formAction, pending] = useActionState(action, EMPTY);

    return (
        <main className="mx-auto flex max-w-md flex-col px-6 py-24 font-[var(--font-poppins)]">
            <h1 className="mb-8 text-center text-4xl font-bold text-[#153D74] font-[var(--font-lora)]">
                {heading}
            </h1>

            <form
                action={formAction}
                className="flex flex-col gap-5 rounded-lg border border-[#3F79AF] bg-white p-6 shadow-sm"
            >
                {state.formError && (
                    <p
                        role="alert"
                        className="rounded-lg border border-red-700 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {state.formError}
                    </p>
                )}

                <Field id="email" label="Email" error={state.errors?.email}>
                    {(aria) => (
                        <TextInput
                            {...aria}
                            name="email"
                            type="email"
                            autoComplete="email"
                            defaultValue={state.values?.email}
                            required
                        />
                    )}
                </Field>

                <Field id="password" label="Password" hint={passwordHint} error={state.errors?.password}>
                    {(aria) => (
                        <TextInput
                            {...aria}
                            name="password"
                            type="password"
                            autoComplete={passwordAutoComplete}
                            required
                        />
                    )}
                </Field>

                <Button type="submit" disabled={pending}>
                    {pending ? "Please wait…" : submitLabel}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-[#4B5563]">{footer}</p>
        </main>
    );
}

export function AuthFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="font-medium text-[#153D74] hover:underline">
            {children}
        </Link>
    );
}