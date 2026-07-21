"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ActivePrompt = { id: string; text: string } | null;

const ActivePromptContext = createContext<{
    activePrompt: ActivePrompt;
    setActivePrompt: (prompt: ActivePrompt) => void;
} | null>(null);

// Lets the "Respond" button on an icebreaker prompt card (rendered deep inside
// MessageList, via ChatClient.tsx's custom Message component) tell
// ModeratedMessageComposer which prompt to pre-fill and tag the next send with - they
// aren't adjacent in the tree, so props alone can't carry this between them.
export function ActivePromptProvider({ children }: { children: ReactNode }) {
    const [activePrompt, setActivePrompt] = useState<ActivePrompt>(null);

    return (
        <ActivePromptContext.Provider value={{ activePrompt, setActivePrompt }}>
            {children}
        </ActivePromptContext.Provider>
    );
}

export function useActivePrompt() {
    const context = useContext(ActivePromptContext);
    if (!context) throw new Error("useActivePrompt must be used within ActivePromptProvider");
    return context;
}
