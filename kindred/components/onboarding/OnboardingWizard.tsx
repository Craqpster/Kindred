"use client";

import { useActionState, useState } from "react";

import { createProfile, type OnboardingState } from "@/app/onboarding/actions";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import TextInput from "@/components/ui/TextInput";
import { ageFrom } from "@/lib/age";
import { randomHandle } from "@/lib/handles";
import type { ResolvedTag } from "@/lib/onboarding-tags";

const TOTAL_STEPS = 5;
const MIN_AGE = 18;

const EASE_IN_OPTIONS = [
    {
        value: "openers",
        title: "I freeze up starting conversations",
        detail: "Don't worry, we'll hand you openers.",
    },
    {
        value: "gradual",
        title: "One-on-one's fine, groups are hard",
        detail: "We'll ease you into your group slowly.",
    },
    {
        value: "volume",
        title: "I just want more people to talk to",
        detail: "We'll keep the matches coming.",
    },
];

const EMPTY: OnboardingState = {};

export default function OnboardingWizard({
    tags,
    initialHandle,
}: {
    tags: readonly ResolvedTag[];
    initialHandle: string;
}) {
    const [state, formAction, pending] = useActionState(createProfile, EMPTY);
    const [step, setStep] = useState(1);

    const [handle, setHandle] = useState(initialHandle);
    const [picked, setPicked] = useState<readonly string[]>([]);
    const [easeIn, setEaseIn] = useState("");
    const [birthDate, setBirthDate] = useState("");

    // The server validates independently; if it rejects something, jump to the step that
    // owns the message rather than leaving it on a screen the user cannot see.
    //
    // Adjusted during render rather than in an effect: React re-runs this immediately
    // without painting the wrong step first, and an effect here trips
    // react-hooks/set-state-in-effect.
    const [seenState, setSeenState] = useState(state);
    if (seenState !== state) {
        setSeenState(state);
        if (state.errorStep) setStep(state.errorStep);
    }

    const age = birthDate ? ageFrom(new Date(birthDate)) : null;
    const oldEnough = age !== null && age >= MIN_AGE && age <= 120;

    const canContinue: Record<number, boolean> = {
        1: true,
        2: true,
        3: handle.trim().length >= 3,
        4: picked.length > 0,
        5: easeIn !== "" && oldEnough,
    };

    const toggleTag = (key: string) =>
        setPicked((current) =>
            current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
        );

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#F0F4EA] px-6 py-12 font-sans">
            <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm sm:p-10">
                <Progress step={step} />

                <form action={formAction} className="mt-8 flex flex-col">
                    {state.formError && (
                        <p
                            role="alert"
                            className="mb-5 rounded-lg border border-red-700 bg-red-50 px-4 py-3 text-sm text-red-700"
                        >
                            {state.formError}
                        </p>
                    )}

                    {/* Every step stays mounted and inactive ones are `hidden`, so the
                        browser still submits their inputs and FormData arrives complete.
                        No cross-step state plumbing, no duplicated hidden fields. */}

                    <Step active={step === 1}>
                        <Heading>Get good at talking to people.</Heading>
                        <Sub>A low-stakes place to talk with real people. No photos, no performance.</Sub>
                    </Step>

                    <Step active={step === 2}>
                        <Heading>Everyone here is a little nervous too.</Heading>
                        <Sub>That&apos;s the point. Nobody&apos;s watching, nobody&apos;s judging.</Sub>
                    </Step>

                    <Step active={step === 3}>
                        <Heading>You, here</Heading>
                        <div className="mt-6">
                            <Field id="username" label="Your handle" error={state.errors?.username}>
                                {(aria) => (
                                    <div className="flex gap-2">
                                        <TextInput
                                            {...aria}
                                            name="username"
                                            value={handle}
                                            onChange={(e) => setHandle(e.target.value)}
                                            maxLength={20}
                                            autoComplete="off"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setHandle(randomHandle())}
                                            className="shrink-0 rounded-lg border border-[#3F79AF] px-4 text-sm font-medium text-[#153D74] transition hover:bg-[#EAE6DD]"
                                        >
                                            Shuffle
                                        </button>
                                    </div>
                                )}
                            </Field>
                        </div>
                    </Step>

                    <Step active={step === 4}>
                        <Heading>What are you into?</Heading>
                        <Sub>These become your openers.</Sub>

                        <div className="mt-6 flex flex-wrap gap-2">
                            {tags.map((tag) => {
                                const key = `${tag.source}-${tag.id}`;
                                return (
                                    <label
                                        key={key}
                                        className="cursor-pointer rounded-full border border-[#689CD5] bg-[#689CD5]/10 px-4 py-2 text-sm text-[#153D74] transition select-none has-checked:border-[#153D74] has-checked:bg-[#153D74] has-checked:text-white hover:bg-[#689CD5]/20"
                                    >
                                        <input
                                            type="checkbox"
                                            /* One grid, two tables: the name decides which
                                               junction the id lands in. */
                                            name={tag.source === "hobby" ? "hobby_ids" : "interest_ids"}
                                            value={tag.id}
                                            checked={picked.includes(key)}
                                            onChange={() => toggleTag(key)}
                                            className="sr-only"
                                        />
                                        {tag.name}
                                    </label>
                                );
                            })}
                        </div>

                        {state.errors?.tags && (
                            <p role="alert" className="mt-3 text-sm text-red-700">
                                {state.errors.tags[0]}
                            </p>
                        )}
                    </Step>

                    <Step active={step === 5}>
                        <Heading>How do you want to ease in?</Heading>

                        <div className="mt-6 flex flex-col gap-3">
                            {EASE_IN_OPTIONS.map((option) => (
                                <label
                                    key={option.value}
                                    className="cursor-pointer rounded-lg border border-[#3F79AF] p-4 transition select-none has-checked:border-[#153D74] has-checked:bg-[#689CD5]/10 hover:bg-[#EAE6DD]/50"
                                >
                                    <input
                                        type="radio"
                                        name="ease_in"
                                        value={option.value}
                                        checked={easeIn === option.value}
                                        onChange={() => setEaseIn(option.value)}
                                        className="sr-only"
                                    />
                                    <span className="block font-medium text-[#153D74]">{option.title}</span>
                                    <span className="mt-1 block text-sm text-[#4B5563]">{option.detail}</span>
                                </label>
                            ))}
                        </div>

                        <div className="mt-6">
                            <Field
                                id="birth_date"
                                label="Your date of birth"
                                hint={`You need to be ${MIN_AGE} or older.`}
                                error={state.errors?.birth_date}
                            >
                                {(aria) => (
                                    <TextInput
                                        {...aria}
                                        name="birth_date"
                                        type="date"
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                    />
                                )}
                            </Field>
                        </div>
                    </Step>

                    <div className="mt-8">
                        {step < TOTAL_STEPS ? (
                            <Button
                                type="button"
                                onClick={() => setStep(step + 1)}
                                disabled={!canContinue[step]}
                                className="w-full"
                            >
                                {step === 1 ? "Start" : step === 2 ? "Okay, I'm in" : "Continue"}
                            </Button>
                        ) : (
                            <Button type="submit" disabled={!canContinue[5] || pending} className="w-full">
                                {pending ? "Setting you up…" : "Continue"}
                            </Button>
                        )}

                        {step > 1 && (
                            <button
                                type="button"
                                onClick={() => setStep(step - 1)}
                                className="mt-4 text-sm text-[#4B5563] transition hover:text-[#153D74]"
                            >
                                ‹ Back
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </main>
    );
}

function Progress({ step }: { step: number }) {
    return (
        <ol className="flex items-center justify-center gap-2" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
                const reached = i < step;
                return (
                    <li
                        key={i}
                        aria-current={i === step - 1 ? "step" : undefined}
                        className={`h-1.5 rounded-full transition-all ${
                            reached ? "w-6 bg-[#153D74]" : "w-1.5 bg-gray-300"
                        }`}
                    />
                );
            })}
        </ol>
    );
}

/// `hidden` rather than unmounting: the inputs must stay in the form to be submitted.
function Step({ active, children }: { active: boolean; children: React.ReactNode }) {
    return <div hidden={!active}>{children}</div>;
}

function Heading({ children }: { children: React.ReactNode }) {
    return (
        <h1 className="text-3xl font-bold text-[#153D74]">{children}</h1>
    );
}

function Sub({ children }: { children: React.ReactNode }) {
    return <p className="mt-3 text-[#4B5563]">{children}</p>;
}