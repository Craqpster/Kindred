"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import * as Switch from "@radix-ui/react-switch";
import { ChevronDown, Check, Shuffle } from "lucide-react";
import type { ProfileWithRelations } from "@/lib/dal";
import Button from "@/components/ui/Button";

const AVATAR_STYLES = [
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

const AVATAR_SEED_OPTIONS = Array.from({ length: 12 }, (_, i) => `option-${i + 1}`);

const ADJECTIVES = ["happy", "lucky", "kind", "calm", "bright", "swift", "bold", "cosmic", "gentle"];
const NOUNS = ["otter", "fox", "bear", "bird", "wolf", "deer", "lynx", "finch", "sage"];

function generateRandomHandle(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const number = Math.floor(Math.random() * 900) + 100;
    return `${adjective}_${noun}_${number}`;
}

export function PrivacySettings({
    profile,
    genders = [],
    onProfilePreview,
}: {
    profile: ProfileWithRelations;
    genders?: { id: number; label: string }[];
    onProfilePreview?: (update: { username?: string; gender_id?: number; avatar_id?: string; avatar_seed?: string }) => void;
}) {
    const router = useRouter();
    const cardRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const [settings, setSettings] = useState({
        username: profile.username,
        gender_id: profile.gender_id ?? genders[0]?.id ?? 1,
        avatar_id: profile.avatar_id || "adventurer",
        avatar_seed: profile.avatar_seed || profile.username,
        dms_open: profile.dms_open ?? true,
        show_confidence: profile.show_confidence ?? true,
        show_interests: profile.show_interests ?? true,
    });

    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");

    // Auto-scrolls so the top of this card sits right at the top of the viewport
    useEffect(() => {
        if (isExpanded && cardRef.current) {
            const element = cardRef.current;
            const y = element.getBoundingClientRect().top + window.pageYOffset - 24;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
    }, [isExpanded]);

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        onProfilePreview?.({ [key]: value });
    };

    const handleUsernameShuffle = () => {
        const newHandle = generateRandomHandle();
        updateSetting("username", newHandle);
    };

    const handleAvatarShuffle = () => {
        const randomSeed = AVATAR_SEED_OPTIONS[Math.floor(Math.random() * AVATAR_SEED_OPTIONS.length)];
        updateSetting("avatar_seed", randomSeed);
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSaving(true);
        setMessage("");
        try {
            const res = await fetch("/api/profile/privacy", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (!res.ok) throw new Error("Failed");
            setMessage("Saved!");
            setTimeout(() => setMessage(""), 2000);
            router.refresh();
        } catch {
            setMessage("Error saving.");
        } finally {
            setIsSaving(false);
        }
    };

    const genderOptions = genders.map(g => ({ val: String(g.id), label: g.label }));

    return (
        <div ref={cardRef}>
            {/* Accordion Header */}
            <div 
                className="flex justify-between items-center cursor-pointer group select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-1">
                    <h2 className="font-display text-xl font-bold text-star-sapphire">Privacy & Appearance</h2>
                    <p className="text-sm text-star-sapphire/70">Control your visibility, look, and details</p>
                </div>
                
                <div className="flex items-center gap-3">
                    {isExpanded && (
                        <Button 
                            variant="secondary"
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </Button>
                    )}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}>
                        <ChevronDown className="h-5 w-5 text-star-sapphire/40 group-hover:text-star-sapphire transition-colors" />
                    </motion.div>
                </div>
            </div>

            {/* Accordion Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden pt-6"
                    >
                        {message && <p className="text-sm font-medium text-star-sapphire mb-4">{message}</p>}

                        <div className="space-y-6">
                            
                            {/* Username Editor with Shuffle Button */}
                            <div className="flex items-center justify-between pb-4 border-b border-star-sapphire/8">
                                <div>
                                    <h3 className="font-semibold text-sm text-star-sapphire">Username</h3>
                                    <p className="text-xs text-star-sapphire/60">Your unique handle on Kindred</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleUsernameShuffle}
                                        title="Generate random handle"
                                        className="p-2 rounded-xl border border-star-sapphire/10 bg-bone-100 text-star-sapphire hover:bg-bone-200 transition-colors"
                                    >
                                        <Shuffle className="h-4 w-4" />
                                    </button>
                                    <input
                                        type="text"
                                        maxLength={20}
                                        value={settings.username}
                                        onChange={(e) => updateSetting("username", e.target.value)}
                                        className="w-40 rounded-xl border border-star-sapphire/10 bg-bone-100 px-3.5 py-2 text-sm text-star-sapphire outline-none transition-colors focus:border-star-sapphire"
                                    />
                                </div>
                            </div>

                            {/* Gender Editor */}
                            <div className="flex items-center justify-between pb-4 border-b border-star-sapphire/8 relative z-20">
                                <div>
                                    <h3 className="font-semibold text-sm text-star-sapphire">Gender</h3>
                                    <p className="text-xs text-star-sapphire/60">How you identify</p>
                                </div>
                                <BeUISelect 
                                    value={String(settings.gender_id)} 
                                    onChange={(val) => updateSetting("gender_id", Number(val))} 
                                    options={genderOptions} 
                                />
                            </div>

                            {/* Avatar Style & Shuffle */}
                            <div className="flex items-center justify-between pb-4 border-b border-star-sapphire/8 relative z-10">
                                <div>
                                    <h3 className="font-semibold text-sm text-star-sapphire">Avatar Style</h3>
                                    <p className="text-xs text-star-sapphire/60">Choose your Dicebear style</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleAvatarShuffle}
                                        title="Get a random look"
                                        className="p-2 rounded-xl border border-star-sapphire/10 bg-bone-100 text-star-sapphire hover:bg-bone-200 transition-colors"
                                    >
                                        <Shuffle className="h-4 w-4" />
                                    </button>

                                    <BeUISelect 
                                        value={settings.avatar_id} 
                                        onChange={(val) => updateSetting("avatar_id", val)} 
                                        options={AVATAR_STYLES} 
                                    />
                                </div>
                            </div>

                            {/* Specific Seed Grid */}
                            <div className="pb-4 border-b border-star-sapphire/8">
                                <p className="text-xs font-semibold uppercase tracking-wider text-star-sapphire/60 mb-3">Or pick a specific look</p>
                                <div className="flex gap-2 flex-wrap">
                                    {AVATAR_SEED_OPTIONS.map(seed => (
                                        <button
                                            key={seed}
                                            type="button"
                                            onClick={() => updateSetting("avatar_seed", seed)}
                                            title="Use this look"
                                            className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all ${
                                                settings.avatar_seed === seed
                                                    ? "border-star-sapphire scale-105 shadow-sm"
                                                    : "border-transparent opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            <Image
                                                src={`https://api.dicebear.com/9.x/${settings.avatar_id}/svg?seed=${seed}`}
                                                alt="Avatar option"
                                                width={44}
                                                height={44}
                                                unoptimized
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Toggles */}
                            {[
                                { id: "dms_open", label: "Open DMs", desc: "Allow anyone to send you a message" },
                                { id: "show_confidence", label: "Show Confidence Tier", desc: "Display tier on your profile" },
                                { id: "show_interests", label: "Show Interests", desc: "Make your hobbies public" }
                            ].map((item) => (
                                <div key={item.id} className="flex items-center justify-between py-1 border-b border-star-sapphire/8 last:border-0">
                                    <div>
                                        <h3 className="font-semibold text-sm text-star-sapphire">{item.label}</h3>
                                        <p className="text-xs text-star-sapphire/60">{item.desc}</p>
                                    </div>
                                    <Switch.Root
                                        checked={settings[item.id as keyof typeof settings] as boolean}
                                        onCheckedChange={(checked: boolean) => updateSetting(item.id, checked)}
                                        className="w-[42px] h-[24px] bg-bone-200 rounded-full relative outline-none data-[state=checked]:bg-star-sapphire transition-colors shadow-inner cursor-pointer"
                                    >
                                        <Switch.Thumb className="block w-[20px] h-[20px] bg-surface rounded-full shadow transition-transform duration-200 translate-x-0.5 data-[state=checked]:translate-x-[19px]" />
                                    </Switch.Root>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ----------------------------------------------------------------------------
// beUI-inspired Select Component
// ----------------------------------------------------------------------------
function BeUISelect({ value, onChange, options }: { value: string; onChange: (val: string) => void; options: { val: string; label: string }[] }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener("pointerdown", onPointerDown);
        return () => window.removeEventListener("pointerdown", onPointerDown);
    }, [open]);

    const activeLabel = options.find(o => o.val === value)?.label || "Select";

    return (
        <div ref={containerRef} className="relative z-50">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-star-sapphire/10 bg-bone-100 px-3.5 py-2 text-sm font-medium text-star-sapphire outline-none transition-colors hover:bg-bone-200"
            >
                {activeLabel}
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}>
                    <ChevronDown size={14} className="text-star-sapphire/70" />
                </motion.span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{
                            opacity: open ? { duration: 0.18 } : { duration: 0.16, delay: 0.15 },
                            height: { type: "spring", duration: 0.42, bounce: 0.14 },
                            marginTop: { type: "spring", duration: 0.4, bounce: 0.3 }
                        }}
                        style={{ overflow: "hidden", transformOrigin: "top" }}
                        className="absolute right-0 top-full w-48 rounded-xl border border-star-sapphire/10 bg-surface shadow-hero p-1.5 z-50"
                    >
                        <motion.div
                            variants={{
                                hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
                                show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } }
                            }}
                            initial="hidden"
                            animate="show"
                            exit="hidden"
                            className="flex flex-col gap-0.5 overflow-y-auto max-h-[200px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                        >
                            {options.map((opt) => {
                                const selected = value === opt.val;
                                return (
                                    <motion.button
                                        key={opt.val}
                                        type="button"
                                        onClick={() => { onChange(opt.val); setOpen(false); }}
                                        variants={{
                                            hidden: { opacity: 0, y: -6, filter: "blur(3px)" },
                                            show: { opacity: 1, y: 0, filter: "blur(0px)" }
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors ${
                                            selected ? 'bg-bone-100 font-semibold text-star-sapphire' : 'text-star-sapphire/80 hover:bg-bone-100 hover:text-star-sapphire'
                                        }`}
                                    >
                                        {opt.label}
                                        {selected && <Check size={14} className="text-star-sapphire shrink-0" />}
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}