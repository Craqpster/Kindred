export const TOTAL_STEPS = 7;
export const MIN_AGE = 18;

export const EASE_IN_OPTIONS = [
    { value: "openers", title: "I freeze up starting conversations", detail: "Don't worry, we'll hand you openers." },
    { value: "gradual", title: "One-on-one's fine, groups are hard", detail: "We'll ease you into your group slowly." },
    { value: "volume", title: "I just want more people to talk to", detail: "We'll keep the matches coming." },
];

export const AVATAR_STYLES = [
    { val: "adventurer", label: "Adventurer" },
    { val: "avataaars", label: "Avataaars" },
    { val: "bottts", label: "Bottts" },
    { val: "fun-emoji", label: "Fun Emoji" },
    { val: "identicon", label: "Identicon" },
    { val: "lorelei", label: "Lorelei" },
    { val: "notionists", label: "Notionists" },
    { val: "open-peeps", label: "Open Peeps" },
    { val: "pixel-art", label: "Pixel Art" }
];

export const AVATAR_SEED_OPTIONS = Array.from({ length: 12 }, (_, i) => `option-${i + 1}`);

// Soft Clay design tokens for interactive elements
export const CHIP = "cursor-pointer rounded-full border border-ink-900/10 bg-surface px-5 py-2.5 text-sm font-medium text-ink-900 shadow-sm transition-all select-none has-checked:border-ink-900 has-checked:bg-ink-900 has-checked:text-surface hover:bg-bone-100 has-checked:hover:bg-ink-900";

export const OPTION_CARD = "cursor-pointer rounded-2xl border border-ink-900/8 bg-surface p-5 text-center shadow-sm transition-[translate,box-shadow,border-color] duration-250 ease-smooth select-none has-checked:border-ink-900 has-checked:bg-bone-100 has-checked:ring-1 has-checked:ring-ink-900 hover:shadow-card hover:-translate-y-px";