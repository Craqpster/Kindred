"use client";

import { useActionState, useState } from "react";
import { motion } from "motion/react";

import { createProfile, type OnboardingState } from "@/app/onboarding/actions";
import TextInput from "@/components/ui/TextInput";
import { ageFrom } from "@/lib/age";
import type { ResolvedTag } from "@/lib/onboarding-tags";

import { AVATAR_STYLES, AVATAR_SEED_OPTIONS, MIN_AGE } from "./constants";
import { Progress, Step, Heading, Sub, NavigationFooter } from "./WizardLayout";
import { AvatarLookSelector } from "./AvatarSelector";
import { HandleSelector, TagSelector, EaseInSelector, GenderSelector } from "./FormSelectors";

const EMPTY: OnboardingState = {};

export default function OnboardingWizard({
    tags,
    genders,
    initialHandle,
}: {
    tags: readonly ResolvedTag[];
    genders: readonly { id: number; label: string }[];
    initialHandle: string;
}) {
    const [state, formAction, pending] = useActionState(createProfile, EMPTY);
    const [step, setStep] = useState(1);

    const [handle, setHandle] = useState(initialHandle);
    const [avatarStyle, setAvatarStyle] = useState(AVATAR_STYLES[0].val);
    const [avatarSeed, setAvatarSeed] = useState(AVATAR_SEED_OPTIONS[0]);
    const [picked, setPicked] = useState<readonly string[]>([]);
    const [gender, setGender] = useState("");
    const [easeIn, setEaseIn] = useState("");
    const [birthDate, setBirthDate] = useState("");

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
        5: easeIn !== "",
        6: true,
        7: oldEnough,
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-bone-100 px-6 py-12 font-body text-ink-900">
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg"
            >
                <div className="flex flex-col rounded-hero border border-ink-900/8 bg-surface p-8 text-center shadow-hero sm:p-10">
                    <Progress step={step} />

                    <form action={formAction} className="mt-8 flex flex-col">
                        {state.formError && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-5 overflow-hidden">
                                <p role="alert" className="rounded-xl border border-red-500/20 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {state.formError}
                                </p>
                            </motion.div>
                        )}

                        {/* Server Inputs */}
                        <input type="hidden" name="avatar_id" value={avatarStyle} />
                        <input type="hidden" name="avatar_seed" value={avatarSeed} />

                        {/* --- Steps --- */}
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
                            <Sub>Pick a look and a handle.</Sub>
                            <div className="mt-8 flex flex-col gap-10 text-left">
                                <AvatarLookSelector 
                                    avatarStyle={avatarStyle} 
                                    setAvatarStyle={setAvatarStyle} 
                                    avatarSeed={avatarSeed} 
                                    setAvatarSeed={setAvatarSeed} 
                                />
                                <HandleSelector 
                                    handle={handle} 
                                    setHandle={setHandle} 
                                    error={state.errors?.username} 
                                />
                            </div>
                        </Step>

                        <Step active={step === 4}>
                            <Heading>What are you into?</Heading>
                            <Sub>These become your openers.</Sub>
                            <TagSelector tags={tags} picked={picked} setPicked={setPicked} error={state.errors?.tags} />
                        </Step>

                        <Step active={step === 5}>
                            <Heading>How do you want to ease in?</Heading>
                            <EaseInSelector easeIn={easeIn} setEaseIn={setEaseIn} />
                        </Step>

                        <Step active={step === 6}>
                            <Heading>How do you identify?</Heading>
                            <Sub>Entirely optional — skip it if you&apos;d rather not say.</Sub>
                            <GenderSelector genders={genders} gender={gender} setGender={setGender} />
                        </Step>

                        <Step active={step === 7}>
                            <Heading>When were you born?</Heading>
                            <Sub>Kindred is for people {MIN_AGE} and over.</Sub>
                            <div className="mt-8 text-left">
                                <label htmlFor="birth_date" className="mb-2 block text-sm font-medium text-ink-900">Your date of birth</label>
                                <TextInput
                                    id="birth_date"
                                    name="birth_date"
                                    type="date"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    className="w-full rounded-xl border border-ink-900/8 bg-surface px-4 py-2.5 text-sm text-ink-900 transition-colors focus:border-ink-900 focus:outline-none focus:ring-1 focus:ring-ink-900"
                                />
                                {state.errors?.birth_date && <p className="mt-1.5 text-sm font-medium text-red-600">{state.errors.birth_date}</p>}
                            </div>
                        </Step>

                        <NavigationFooter step={step} setStep={setStep} canContinue={canContinue} pending={pending} />
                    </form>
                </div>
            </motion.div>
        </main>
    );
}