"use client";

import { Shuffle } from "lucide-react";
import TextInput from "@/components/ui/TextInput";
import { randomHandle } from "@/lib/handles";
import { CHIP, OPTION_CARD, EASE_IN_OPTIONS } from "./constants";

export function HandleSelector({ handle, setHandle, error }: any) {
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor="username" className="block text-sm font-medium text-ink-900">Your handle</label>
            <div className="flex gap-2">
                <TextInput
                    id="username"
                    name="username"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    maxLength={20}
                    autoComplete="off"
                    className="w-full rounded-xl border border-ink-900/8 bg-surface px-4 py-2.5 text-sm text-ink-900 transition-colors focus:border-ink-900 focus:outline-none focus:ring-1 focus:ring-ink-900"
                />
                <button
                    type="button"
                    onClick={() => setHandle(randomHandle())}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl border border-ink-900/8 bg-surface px-3 py-2.5 text-sm font-medium text-ink-900 shadow-sm transition-[translate,box-shadow,background-color] hover:-translate-y-px hover:bg-bone-100 hover:shadow-card active:translate-y-0 active:shadow-sm"
                >
                    <Shuffle size={14} className="text-ink-600" />
                    Shuffle
                </button>
            </div>
            {error && <p className="mt-1 text-sm font-medium text-red-600">{error}</p>}
        </div>
    );
}

export function TagSelector({ tags, picked, setPicked, error }: any) {
    const toggleTag = (key: string) => setPicked((current: string[]) => current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);

    return (
        <>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                {tags.map((tag: any) => {
                    const key = `${tag.source}-${tag.id}`;
                    return (
                        <label key={key} className={CHIP}>
                            <input type="checkbox" name={tag.source === "hobby" ? "hobby_ids" : "interest_ids"} value={tag.id} checked={picked.includes(key)} onChange={() => toggleTag(key)} className="sr-only" />
                            {tag.name}
                        </label>
                    );
                })}
            </div>
            {error && <p className="mt-4 text-sm font-medium text-red-600">{error[0]}</p>}
        </>
    );
}

export function EaseInSelector({ easeIn, setEaseIn }: any) {
    return (
        <div className="mt-8 flex flex-col gap-4">
            {EASE_IN_OPTIONS.map((option) => (
                <label key={option.value} className={OPTION_CARD}>
                    <input type="radio" name="ease_in" value={option.value} checked={easeIn === option.value} onChange={() => setEaseIn(option.value)} className="sr-only" />
                    <span className="block font-medium text-ink-900">{option.title}</span>
                    <span className="mt-1 block text-sm text-ink-600">{option.detail}</span>
                </label>
            ))}
        </div>
    );
}

export function GenderSelector({ genders, gender, setGender }: any) {
    return (
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {genders.map((option: any) => (
                <label key={option.id} className={CHIP}>
                    <input type="radio" name="gender_id" value={option.id} checked={gender === String(option.id)} onChange={() => setGender(String(option.id))} className="sr-only" />
                    {option.label}
                </label>
            ))}
        </div>
    );
}