"use client";

import { useActionState, useState } from "react";
import { AlertCircle, TriangleAlert } from "lucide-react";

import { deleteMyAccount, type DeleteAccountState } from "@/app/(app)/me/actions";

const EMPTY: DeleteAccountState = {};

/// Deleting your account, and the last thing on the profile page for a reason.
///
/// Expands in place rather than opening a modal. A modal would need a focus trap, an escape
/// key handler and a portal to be accessible, and none of that buys anything a settings page
/// does not already have: nothing is behind this section to be blocked out.
///
/// The password field is not rendered until the section is opened. A password input sitting on
/// the page is one a manager may helpfully fill in, and an autofilled delete form is one
/// keypress from being submitted by accident.
export default function DeleteAccount() {
    const [state, formAction, pending] = useActionState(deleteMyAccount, EMPTY);
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState("");

    return (
        <section>
            <h2 className="font-display text-xl font-bold text-star-sapphire">Delete account</h2>
            <p className="mt-1 text-sm text-star-sapphire/70">
                Your profile, messages, connections and badges are removed for good. This cannot
                be undone and there is no grace period.
            </p>

            {!open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-4 cursor-pointer rounded-full border border-bone-300 px-4 py-2 text-meta text-ink-600 transition-colors hover:border-red-500/40 hover:text-red-700"
                >
                    Delete my account
                </button>
            ) : (
                <div className="mt-4 rounded-card border border-red-500/20 bg-red-50/50 p-4">
                    <p className="flex items-start gap-2 text-meta text-ink-900">
                        <TriangleAlert
                            size={16}
                            strokeWidth={1.5}
                            className="mt-0.5 shrink-0 text-red-700"
                            aria-hidden
                        />
                        <span>
                            Conversations you are part of lose the messages you sent. Enter your
                            password to confirm it is you.
                        </span>
                    </p>

                    <form action={formAction} className="mt-4 flex flex-col gap-3">
                        <div>
                            <label
                                htmlFor="delete-password"
                                className="text-label font-medium text-ink-600"
                            >
                                Password
                            </label>
                            <input
                                id="delete-password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-ink-900/10 bg-surface px-3 py-2 text-meta text-ink-900 transition-colors outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50"
                            />
                        </div>

                        {state.error && (
                            <p
                                role="alert"
                                className="flex items-center gap-1.5 text-label font-medium text-red-700"
                            >
                                <AlertCircle size={14} strokeWidth={1.5} className="shrink-0" />
                                {state.error}
                            </p>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                type="submit"
                                disabled={pending || password.length === 0}
                                className="cursor-pointer rounded-full bg-red-600 px-4 py-2 text-meta font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-600/40"
                            >
                                {pending ? "Deleting…" : "Delete forever"}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    setPassword("");
                                }}
                                className="cursor-pointer rounded-full border border-bone-300 px-4 py-2 text-meta text-ink-600 transition-colors hover:border-ink-900/20 hover:text-ink-900"
                            >
                                Keep my account
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
}
