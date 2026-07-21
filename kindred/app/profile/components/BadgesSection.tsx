"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ProfileWithRelations } from "@/lib/dal";

export function BadgesSection({
  profileBadges,
}: {
  profileBadges: ProfileWithRelations["profile_badges"];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Unlock hints with emojis to show how to get each badge
  const unlockHints: Record<string, string> = {
    "Ice Breaker": "Say hi to someone 👋",
    "Social Butterfly": "Reach Tier 2 🦋",
    "Kindred Spirit": "Reach Tier 3 ✨",
    "Early Bird": "Be active before 9am ⏰",
    "Night Owl": "Be active before 3am 🌙",
    "Community Helper": "Help in a group chat 🛠️",
    "Daily Streak": "Log in 3 days in a row 🔥",
    "Game Starter": "Start a game 🎲",
    "Game Winner": "Win a game 🏆",
    "Chat Explorer": "Visit 5 unique rooms 🧭",
    "Emoji Master": "Send 50 emoji messages 😄",
    "Conversation Starter": "Start 10 chats 💬",
    "Friend Maker": "Make 3 friends 🌿",
  };

  const order = [
    "Ice Breaker",
    "Social Butterfly",
    "Kindred Spirit",
    "Early Bird",
    "Night Owl",
    "Community Helper",
    "Daily Streak",
    "Game Starter",
    "Game Winner",
    "Chat Explorer",
    "Emoji Master",
    "Conversation Starter",
    "Friend Maker",
  ];

  const unlockedNames = new Set(
    (profileBadges || []).map((pb) => pb?.badge?.name).filter(Boolean) as string[]
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-star-sapphire font-[var(--font-lora)] select-none">Achievements</h2>
        <p className="text-gray-600 text-sm select-none">Badges earned</p>
      </div>

      <div
        className="flex justify-between items-center mb-4 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-star-sapphire transition-colors" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-star-sapphire transition-colors" />
          )}
          <div>
            <h2 className="text-xl font-bold text-star-sapphire font-[var(--font-lora)] select-none">View badges</h2>
            <p className="text-gray-600 text-sm select-none">See all badges and how to unlock them</p>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="pl-7 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {order.map((name) => {
              const found = (profileBadges || []).find((pb) => pb?.badge?.name === name);
              const b = found?.badge || { name, description: "", icon: "" };

              const unlocked = unlockedNames.has(name);

              const classes = `flex flex-col items-center justify-center text-center p-4 rounded-2xl border transition-all duration-300 ${
                unlocked ? "opacity-100" : "opacity-50 grayscale cursor-default"
              }`;

              const unlockInfo = unlockHints[name] || b.description || "";
              const title = unlocked ? b.description || unlockInfo : `Locked — ${unlockInfo}`;

              return (
                <div key={name} className={classes} title={title}>
                  {b.icon && <div className="text-3xl mb-2">{b.icon}</div>}
                  <h3 className="font-semibold text-sm text-star-sapphire">{b.name}</h3>
                  <p className="text-xs text-gray-600 mt-2">{unlocked ? b.description || unlockInfo : unlockInfo}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
