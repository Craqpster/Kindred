"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  const [selectedHobbies, setSelectedHobbies] = useState<Set<number>>(new Set(userHobbies));
  const [selectedInterests, setSelectedInterests] = useState<Set<number>>(new Set(userInterests));
  const [hobbiesExpanded, setHobbiesExpanded] = useState(false);
  const [interestsExpanded, setInterestsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  const renderSection = (
    title: string,
    items: Item[],
    selected: Set<number>,
    setSelected: React.Dispatch<React.SetStateAction<Set<number>>>,
    isExpanded: boolean,
    setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  ) => (
    <div className="mb-4">
      <div
        className="flex items-center justify-between py-2 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-star-sapphire transition-colors" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-star-sapphire transition-colors" />
          )}
          <h3 className="text-sm font-semibold text-star-sapphire select-none">{title}</h3>
        </div>
        <span className="text-xs text-gray-500 select-none">{selected.size} selected</span>
      </div>

      {isExpanded && (
        <div className="pl-6 pt-1 flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar animate-in slide-in-from-top-2 fade-in duration-200">
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
                className={`px-3 py-1.5 rounded-full transition-colors text-sm border ${isSelected ? 'bg-iceland/20 border-iceland/30 text-metro-blue font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-mist hover:border-mist'}`}
              >
                {item.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-star-sapphire font-[var(--font-lora)]">Hobbies & Interests</h2>
          <p className="text-gray-600 text-sm">Select what you love</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-metro-blue hover:text-star-sapphire text-sm font-medium disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {message && <p className="text-sm text-metro-blue mb-4">{message}</p>}

      {renderSection("Hobbies", hobbies, selectedHobbies, setSelectedHobbies, hobbiesExpanded, setHobbiesExpanded)}
      {renderSection("Interests", interests, selectedInterests, setSelectedInterests, interestsExpanded, setInterestsExpanded)}
    </div>
  );
}
