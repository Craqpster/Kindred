"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, AlertCircle } from "lucide-react";

import type { AuthState } from "@/app/auth/actions";

type SingleFieldAuthFormProps = {
    action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
    heading: string;
    field: {
        name: "email" | "password";
        label: string;
        type: "email" | "password";
        autoComplete: string;
    };
    hint?: string;
    submitLabel: string;
    /// Shown in place of the form once the action has said its piece. Sending a reset email has
    /// no visible result, so without this the page looks like the button did nothing.
    notice?: string;
    backHref: string;
    footer: React.ReactNode;
};

const EMPTY: AuthState = {};

/// The login card with one field instead of two.
///
/// Password reset asks for an email on the way out and a password on the way back, never both
/// at once. AuthForm hardcodes the pair, and making each half optional there would put
/// conditionals in the screen everyone uses for the sake of the two almost nobody does.
export default function SingleFieldAuthForm({
    action,
    heading,
    field,
    hint,
    submitLabel,
    notice,
    backHref,
    footer,
}: SingleFieldAuthFormProps) {
    const [state, formAction, pending] = useActionState(action, EMPTY);
    const [value, setValue] = useState("");

    const fieldError = state.errors?.[field.name];
    // The action redirects when it succeeds, so anything coming back here is either an error or
    // the reset email's "we sent it if it exists" — which is not a failure, just the only answer
    // we are willing to give.
    const done = Boolean(notice && state.formError);

    return (
        <main className="relative flex min-h-screen w-full items-center justify-center bg-bone-100 px-6 font-body text-ink-900">
            <div className="absolute top-6 left-6 sm:top-10 sm:left-10">
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-2 rounded-full border border-star-sapphire/8 bg-surface/80 px-4 py-2 text-sm font-medium text-ink-600 shadow-xs backdrop-blur-md transition-colors hover:bg-surface hover:text-star-sapphire"
                >
                    <ArrowLeft size={16} strokeWidth={1.5} />
                    <span>Back</span>
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-md"
            >
                <div className="flex flex-col rounded-hero border border-star-sapphire/10 bg-surface/85 p-8 shadow-card backdrop-blur-2xl sm:p-10">
                    <div className="mb-8 text-center">
                        <h1 className="font-display text-3xl font-bold tracking-tight text-star-sapphire">
                            Kindred
                        </h1>
                        <p className="text-body mt-2 text-star-sapphire/70">{heading}</p>
                    </div>

                    {done ? (
                        <p className="text-body rounded-2xl border border-star-sapphire/10 bg-bone-100/70 px-4 py-4 text-center text-star-sapphire/80">
                            {notice}
                        </p>
                    ) : (
                        <form action={formAction} className="flex flex-col gap-5">
                            {state.formError && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="overflow-hidden"
                                >
                                    <p
                                        role="alert"
                                        className="rounded-xl border border-red-500/20 bg-red-50 px-4 py-3 text-sm text-red-700"
                                    >
                                        {state.formError}
                                    </p>
                                </motion.div>
                            )}

                            <div className="relative">
                                <input
                                    name={field.name}
                                    id={field.name}
                                    type={field.type}
                                    autoComplete={field.autoComplete}
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder=" "
                                    required
                                    className="peer w-full rounded-2xl border border-star-sapphire/10 bg-bone-100/70 px-4 pt-6 pb-2.5 text-star-sapphire backdrop-blur-sm transition-colors focus:border-star-sapphire focus:bg-surface focus:ring-1 focus:ring-star-sapphire focus:outline-none"
                                />
                                <label
                                    htmlFor={field.name}
                                    className="pointer-events-none absolute top-4 left-4 origin-[0] -translate-y-2.5 scale-[0.8] transform text-star-sapphire/60 transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-[0.8] peer-focus:text-star-sapphire"
                                >
                                    {field.label}
                                </label>

                                {hint && !fieldError && (
                                    <p className="text-meta mt-1.5 px-2 text-star-sapphire/60">
                                        {hint}
                                    </p>
                                )}

                                <AnimatePresence>
                                    {fieldError && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            className="text-meta mt-2 flex items-center gap-1.5 px-2 font-medium text-red-600"
                                        >
                                            <AlertCircle size={14} className="shrink-0" />
                                            <span>{fieldError}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="mt-3">
                                <button
                                    type="submit"
                                    disabled={pending || value.trim().length === 0}
                                    className="inline-flex w-full items-center justify-center rounded-full bg-star-sapphire px-6 py-3 font-medium text-white shadow-xs transition-all hover:bg-star-sapphire/90 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-star-sapphire/30 disabled:text-white/60 disabled:shadow-none"
                                >
                                    {pending ? "Please wait…" : submitLabel}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="text-body mt-8 text-center text-star-sapphire/70">{footer}</p>
            </motion.div>
        </main>
    );
}
