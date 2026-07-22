"use client";

import { motion } from "motion/react";
import type { ProfileWithRelations } from "@/lib/dal";
import Avatar from "@/components/ui/Avatar";

export function ProfileHeader({ profile }: { profile: ProfileWithRelations }) {
    const tier = profile.confidence_level;
    const earnedBadgesCount = profile.profile_badges?.length || 0;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center"
        >
            {/* Outset Soft Clay Shadow (No Border) */}
            <div className="relative mb-5 flex h-32 w-32 items-center justify-center rounded-full bg-bone-200 shadow-hero">
                <Avatar 
                    name={profile.username} 
                    avatarId={profile.avatar_id} 
                    avatarSeed={profile.avatar_seed} 
                    size={120} 
                    className="rounded-full overflow-hidden"
                />
            </div>
            
            <h1 className="font-display text-3xl font-bold tracking-tight text-star-sapphire">
                @{profile.username}
            </h1>

            <div className="flex gap-2.5 mt-4">
                <span className="rounded-full border border-star-sapphire/10 bg-star-sapphire/5 px-4 py-1.5 text-xs font-semibold text-star-sapphire shadow-sm">
                    Tier {tier}
                </span>
                <span className="rounded-full border border-star-sapphire/10 bg-surface px-4 py-1.5 text-xs font-semibold text-star-sapphire shadow-sm">
                    {earnedBadgesCount} {earnedBadgesCount === 1 ? "Badge" : "Badges"}
                </span>
            </div>
        </motion.div>
    );
}