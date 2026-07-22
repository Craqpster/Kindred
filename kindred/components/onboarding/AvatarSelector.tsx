"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { ChevronDown, Check, ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { AVATAR_STYLES, AVATAR_SEED_OPTIONS } from "./constants";

export function AvatarLookSelector({ 
    avatarStyle, 
    setAvatarStyle, 
    avatarSeed, 
    setAvatarSeed 
}: { 
    avatarStyle: string, 
    setAvatarStyle: (val: string) => void, 
    avatarSeed: string, 
    setAvatarSeed: (val: string) => void 
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [seeds, setSeeds] = useState<string[]>(AVATAR_SEED_OPTIONS);

    const handleShuffleLook = () => {
        const newSeed = Math.random().toString(36).slice(2, 10);
        setSeeds(prev => [newSeed, ...prev]);
        setAvatarSeed(newSeed);
        setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }, 50);
    };

    const scroll = (dir: 'left' | 'right') => {
        if (scrollRef.current) {
            const amount = dir === 'left' ? -200 : 200;
            scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    const handleSelect = (seed: string, el: HTMLElement | null) => {
        setAvatarSeed(seed);
        if (el && scrollRef.current) {
            const container = scrollRef.current;
            const scrollLeft = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const activeEl = scrollRef.current?.querySelector('[data-selected="true"]') as HTMLElement;
        if (activeEl && scrollRef.current) {
            const container = scrollRef.current;
            const scrollLeft = activeEl.offsetLeft - container.clientWidth / 2 + activeEl.clientWidth / 2;
            container.scrollTo({ left: scrollLeft, behavior: 'instant' });
        }
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between relative z-50">
                <label className="block text-sm font-medium text-ink-900">Your look</label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleShuffleLook}
                        className="flex items-center gap-1.5 rounded-xl border border-ink-900/8 bg-surface px-3 py-2.5 text-sm font-medium text-ink-900 shadow-sm transition-[translate,box-shadow,background-color] hover:-translate-y-px hover:bg-bone-100 hover:shadow-card active:translate-y-0 active:shadow-sm"
                    >
                        <Shuffle size={14} className="text-ink-600" />
                        Shuffle
                    </button>
                    <AvatarStyleDropdown value={avatarStyle} onChange={setAvatarStyle} />
                </div>
            </div>

            <div className="group/grid relative -mx-8 px-8">
                <button
                    type="button"
                    onClick={() => scroll('left')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/8 bg-surface/90 text-ink-900 shadow-sm opacity-0 backdrop-blur-md transition-all hover:scale-105 hover:bg-bone-100 group-hover/grid:opacity-100"
                >
                    <ChevronLeft size={16} />
                </button>

                <div 
                    ref={scrollRef} 
                    className="flex gap-6 overflow-x-auto py-8 px-[calc(50%-1.75rem)] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                    {seeds.map((seed) => {
                        const isSelected = avatarSeed === seed;
                        return (
                            <motion.button
                                key={seed}
                                data-selected={isSelected}
                                type="button"
                                onClick={(e) => handleSelect(seed, e.currentTarget)}
                                animate={{
                                    scale: isSelected ? 1.5 : 1,
                                    opacity: isSelected ? 1 : 0.4,
                                    zIndex: isSelected ? 10 : 1,
                                }}
                                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                className="relative flex h-14 w-14 shrink-0 snap-center items-center justify-center rounded-full outline-none"
                            >
                                {isSelected && (
                                    <motion.div 
                                        layoutId="avatar-ring" 
                                        className="absolute -inset-[3px] rounded-full border-[2px] border-ink-900" 
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }} 
                                    />
                                )}
                                <div className="h-full w-full overflow-hidden rounded-full bg-bone-100 shadow-sm ring-1 ring-ink-900/10">
                                    <Image src={`https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${seed}`} alt="Avatar option" width={56} height={56} unoptimized />
                                </div>
                            </motion.button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => scroll('right')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/8 bg-surface/90 text-ink-900 shadow-sm opacity-0 backdrop-blur-md transition-all hover:scale-105 hover:bg-bone-100 group-hover/grid:opacity-100"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}

function AvatarStyleDropdown({ value, onChange }: { value: string, onChange: (val: string) => void }) {
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

    const activeLabel = AVATAR_STYLES.find(s => s.val === value)?.label;
    const easeOut = [0.16, 1, 0.3, 1] as const;
    
    const gapT = open
        ? ({ type: "spring", duration: 0.6, bounce: 0.5, delay: 0.12 } as const)
        : ({ type: "spring", duration: 0.3, bounce: 0.1 } as const);
    const radiusT = open ? { duration: 0.3, ease: easeOut, delay: 0.14 } : { duration: 0.16, ease: easeOut };
    const triggerRadiusT = open ? { duration: 0.6, times: [0, 0.4, 1], ease: easeOut } : { duration: 0.42, times: [0, 0.5, 1], ease: easeOut };

    return (
        <div ref={containerRef} className="relative">
            <motion.button
                type="button"
                onClick={() => setOpen(!open)}
                initial={false}
                animate={{ borderBottomLeftRadius: open ? 0 : 12, borderBottomRightRadius: open ? 0 : 12 }}
                transition={{ borderBottomLeftRadius: triggerRadiusT, borderBottomRightRadius: triggerRadiusT }}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-ink-900/8 bg-surface px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm outline-none transition-[box-shadow,background-color] hover:bg-bone-100 focus-visible:ring-2 focus-visible:ring-ink-900/20"
            >
                {activeLabel}
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}>
                    <ChevronDown size={14} className="text-ink-600" />
                </motion.span>
            </motion.button>

            <motion.div
                initial={false}
                animate={{
                    opacity: open ? 1 : 0, height: open ? "auto" : 0, marginTop: open ? 8 : 0,
                    borderTopLeftRadius: open ? 12 : 0, borderTopRightRadius: open ? 12 : 0,
                    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
                }}
                transition={{
                    opacity: open ? { duration: 0.18 } : { duration: 0.16, delay: 0.25 },
                    height: open ? { type: "spring", duration: 0.42, bounce: 0.14 } : { duration: 0.26, ease: easeOut, delay: 0.25 },
                    marginTop: gapT, borderTopLeftRadius: radiusT, borderTopRightRadius: radiusT,
                }}
                style={{ overflow: "hidden", pointerEvents: open ? "auto" : "none", transformOrigin: "top" }}
                className="absolute right-0 top-full w-48 rounded-xl border border-ink-900/8 bg-surface shadow-hero"
            >
                <motion.div
                    variants={{ hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } }, show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } } }}
                    initial={false} animate={open ? "show" : "hidden"}
                    className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                    {AVATAR_STYLES.map((style) => {
                        const selected = value === style.val;
                        return (
                            <motion.button
                                key={style.val} type="button" onClick={() => { onChange(style.val); setOpen(false); }}
                                variants={{ hidden: { opacity: 0, y: -6, filter: "blur(3px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors ${selected ? 'bg-bone-100 font-medium text-ink-900' : 'text-ink-600 hover:bg-bone-100 hover:text-ink-900 focus-visible:bg-bone-100'}`}
                            >
                                {style.label}
                                {selected && <Check size={14} className="text-ink-900 shrink-0" />}
                            </motion.button>
                        );
                    })}
                </motion.div>
            </motion.div>
        </div>
    );
}