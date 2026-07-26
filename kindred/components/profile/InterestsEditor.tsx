"use client";

import { useState, useRef, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";

type Item = { id: number; name: string };

export function InterestsEditor({
    hobbies,
    interests,
    userHobbies,
    userInterests
}: {
    hobbies: Item[];
    interests: Item[];
    userHobbies: number[];
    userInterests: number[];
}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [selectedHobbies, setSelectedHobbies] = useState<Set<number>>(new Set(userHobbies));
    const [selectedInterests, setSelectedInterests] = useState<Set<number>>(new Set(userInterests));
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (isExpanded && cardRef.current) {
            cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [isExpanded]);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage("");
        try {
            const res = await fetch("/api/profile/interests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hobbyIds: Array.from(selectedHobbies),
                    interestIds: Array.from(selectedInterests),
                }),
            });

            if (!res.ok) throw new Error("Failed to save");
            setMessage("Saved!");
            setTimeout(() => setMessage(""), 2000);
        } catch {
            setMessage("Error saving.");
        } finally {
            setIsSaving(false);
        }
    };

    const renderGroup = (
        title: string,
        items: Item[],
        selected: Set<number>,
        setSelected: Dispatch<SetStateAction<Set<number>>>,
    ) => (
        <div className="mb-4 last:mb-0">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-star-sapphire/60 mb-2">{title}</h4>
            <div className="flex flex-wrap gap-2">
                {items.map(item => {
                    const isSelected = selected.has(item.id);
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                const next = new Set(selected);
                                if (isSelected) next.delete(item.id);
                                else next.add(item.id);
                                setSelected(next);
                            }}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isSelected 
                                    ? 'bg-star-sapphire text-surface shadow-sm' 
                                    : 'border border-star-sapphire/10 bg-surface text-star-sapphire/80 hover:bg-bone-100'
                            }`}
                        >
                            {item.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div ref={cardRef}>
            <div 
                className="flex justify-between items-center cursor-pointer group select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div>
                    <h2 className="font-display text-xl font-bold text-star-sapphire">Hobbies & Interests</h2>
                    <p className="text-sm text-star-sapphire/70">Select what you love</p>
                </div>
                
                <div className="flex items-center gap-3">
                    {isExpanded && (
                        <Button 
                            variant="secondary"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleSave(); }}
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

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden pt-6 space-y-4"
                    >
                        {message && <p className="text-sm font-medium text-star-sapphire mb-2">{message}</p>}
                        {renderGroup("Hobbies", hobbies, selectedHobbies, setSelectedHobbies)}
                        {renderGroup("Interests", interests, selectedInterests, setSelectedInterests)}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}