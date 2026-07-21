export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export const BADGES: Badge[] = [
  {
    id: "early_adopter",
    name: "Early Adopter",
    description: "Joined Kindred in its earliest days.",
    icon: "🌱",
  },
  {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Started 10 conversations.",
    icon: "🦋",
  },
  {
    id: "confidence_tier_1",
    name: "Ice Breaker",
    description: "Reached Confidence Tier 1.",
    icon: "🧊",
  },
  {
    id: "confidence_tier_2",
    name: "Smooth Talker",
    description: "Reached Confidence Tier 2.",
    icon: "🗣️",
  },
  {
    id: "confidence_tier_3",
    name: "Charisma King",
    description: "Reached Confidence Tier 3.",
    icon: "👑",
  },
  {
    id: "hobbyist",
    name: "Hobbyist",
    description: "Added 5 hobbies to your profile.",
    icon: "🎨",
  },
];
