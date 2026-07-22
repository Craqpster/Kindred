"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, AlertCircle } from "lucide-react";

import type { AuthState } from "@/app/auth/actions";

type AuthFormProps = {
    action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
    heading: string;
    submitLabel: string;
    passwordHint?: string;
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
    const [email, setEmail] = useState((state.values?.email as string) || "");
    const [password, setPassword] = useState("");

    const isComplete = email.trim().length > 0 && password.trim().length > 0;

    return (
        <main className="relative flex min-h-screen w-full items-center justify-center bg-bone-100 px-6 font-body text-ink-900">
            
            {/* Back Button */}
            <div className="absolute left-6 top-6 sm:left-10 sm:top-10">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-full border border-star-sapphire/8 bg-surface/80 backdrop-blur-md px-4 py-2 text-sm font-medium text-ink-600 shadow-xs transition-colors hover:bg-surface hover:text-star-sapphire"
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
                {/* Soft, warm frosted glass container */}
                <div className="flex flex-col rounded-hero border border-star-sapphire/10 bg-surface/85 backdrop-blur-2xl p-8 shadow-card sm:p-10">
                    
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="font-display text-3xl font-bold tracking-tight text-star-sapphire">
                            Kindred
                        </h1>
                        <p className="mt-2 text-body text-star-sapphire/70">
                            {heading}
                        </p>
                    </div>

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

                        {/* Floating Label Input for Email */}
                        <div className="relative">
                            <input
                                name="email"
                                id="email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder=" "
                                required
                                className="peer w-full rounded-2xl border border-star-sapphire/10 bg-bone-100/70 backdrop-blur-sm px-4 pb-2.5 pt-6 text-star-sapphire transition-colors focus:border-star-sapphire focus:bg-surface focus:outline-none focus:ring-1 focus:ring-star-sapphire"
                            />
                            <label
                                htmlFor="email"
                                className="pointer-events-none absolute left-4 top-4 origin-[0] -translate-y-2.5 scale-[0.8] transform text-star-sapphire/60 transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-[0.8] peer-focus:text-star-sapphire"
                            >
                                Email
                            </label>
                            {state.errors?.email && (
                                <p className="mt-1.5 px-2 text-meta font-medium text-red-600">{state.errors.email}</p>
                            )}
                        </div>

                        {/* Floating Label Input for Password */}
                        <div className="relative">
                            <input
                                name="password"
                                id="password"
                                type="password"
                                autoComplete={passwordAutoComplete}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder=" "
                                required
                                className="peer w-full rounded-2xl border border-star-sapphire/10 bg-bone-100/70 backdrop-blur-sm px-4 pb-2.5 pt-6 text-star-sapphire transition-colors focus:border-star-sapphire focus:bg-surface focus:outline-none focus:ring-1 focus:ring-star-sapphire"
                            />
                            <label
                                htmlFor="password"
                                className="pointer-events-none absolute left-4 top-4 origin-[0] -translate-y-2.5 scale-[0.8] transform text-star-sapphire/60 transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-[0.8] peer-focus:text-star-sapphire"
                            >
                                Password
                            </label>
                            
                            {/* Appealing password hint / validation error */}
                            {passwordHint && !state.errors?.password && (
                                <p className="mt-1.5 px-2 text-meta text-star-sapphire/60">{passwordHint}</p>
                            )}
                            
                            <AnimatePresence>
                                {state.errors?.password && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        className="mt-2 flex items-center gap-1.5 px-2 text-meta font-medium text-red-600"
                                    >
                                        <AlertCircle size={14} className="shrink-0" />
                                        <span>{state.errors.password}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="mt-3">
                            <button
                                type="submit"
                                disabled={pending || !isComplete}
                                className="inline-flex w-full items-center justify-center rounded-full bg-star-sapphire px-6 py-3 font-medium text-white shadow-xs transition-all hover:bg-star-sapphire/90 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-star-sapphire/30 disabled:text-white/60 disabled:shadow-none"
                            >
                                {pending ? "Please wait…" : submitLabel}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Footer Link */}
                <p className="mt-8 text-center text-body text-star-sapphire/70">
                    {footer}
                </p>
            </motion.div>
        </main>
    );
}

export function AuthFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="font-medium text-star-sapphire transition hover:underline">
            {children}
        </Link>
    );
}