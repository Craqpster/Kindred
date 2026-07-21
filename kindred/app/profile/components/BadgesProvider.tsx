"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Badge = any;

const BadgesContext = createContext<{
  badges: Badge[] | null;
  refresh: () => Promise<void>;
} | null>(null);

export function useBadges() {
  const ctx = useContext(BadgesContext);
  if (!ctx) throw new Error("useBadges must be used within BadgesProvider");
  return ctx;
}

export default function BadgesProvider({ children }: { children: React.ReactNode }) {
  const [badges, setBadges] = useState<Badge[] | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/profile/badges");
      if (!res.ok) throw new Error("Failed to load badges");
      const data = await res.json();
      setBadges(data.badges || []);
    } catch (e) {
      console.error("BadgesProvider load failed", e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <BadgesContext.Provider value={{ badges, refresh: load }}>
      {children}
    </BadgesContext.Provider>
  );
}
