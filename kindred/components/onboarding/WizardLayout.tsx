"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { TOTAL_STEPS } from "./constants";

export function Progress({ step }: { step: number }) {
    return (
        <ol className="flex items-center justify-center gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
                const reached = i < step;
                return (
                    <li
                        key={i}
                        aria-current={i === step - 1 ? "step" : undefined}
                        className={`h-1.5 rounded-full transition-all duration-300 ease-smooth ${
                            reached ? "w-6 bg-ink-900" : "w-1.5 bg-ink-900/15"
                        }`}
                    />
                );
            })}
        </ol>
    );
}

export function Step({ active, children }: { active: boolean; children: React.ReactNode }) {
    return (
        <div hidden={!active} className={active ? "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both" : ""}>
            {children}
        </div>
    );
}

export function Heading({ children }: { children: React.ReactNode }) {
    return <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">{children}</h1>;
}

export function Sub({ children }: { children: React.ReactNode }) {
    return <p className="mt-3 text-body leading-relaxed text-ink-600">{children}</p>;
}

export function NavigationFooter({ 
    step, 
    setStep, 
    canContinue, 
    pending 
}: { 
    step: number, 
    setStep: (s: number) => void, 
    canContinue: Record<number, boolean>, 
    pending: boolean 
}) {
    return (
        <div className="mt-10 flex w-full items-center justify-between pt-2">
            {step > 1 ? (
                <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="group flex items-center gap-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900"
                >
                    <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                    Back
                </button>
            ) : <div />}

            <Button
                type={step < TOTAL_STEPS ? "button" : "submit"}
                onClick={step < TOTAL_STEPS ? () => setStep(step + 1) : undefined}
                disabled={!canContinue[step] || pending}
                className="group flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-surface shadow-sm transition-[translate,box-shadow] duration-250 ease-smooth hover:-translate-y-px hover:shadow-card disabled:opacity-70 disabled:hover:translate-y-0"
            >
                {step === 1 ? "Start" : step === 2 ? "I'm in" : step < TOTAL_STEPS ? "Continue" : pending ? "Setting up…" : "Finish"}
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
        </div>
    );
}