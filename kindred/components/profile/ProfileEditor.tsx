"use client";

import { useState } from "react";
import { ageFrom } from "@/lib/age";
import type { ProfileWithRelations } from "@/lib/dal";
import { BadgesSection } from "@/components/profile/BadgesSection";
import { ConfidenceCard } from "@/components/profile/ConfidenceCard";
import { InterestsEditor } from "@/components/profile/InterestsEditor";
import { PrivacySettings } from "@/components/profile/PrivacySettings";
import { ProfileHeader } from "@/components/profile/ProfileHeader";

type HobbyOrInterest = { id: number; name: string };
type GenderOption = { id: number; label: string };

export function ProfileEditor({
    profile,
    allHobbies,
    allInterests,
    userHobbies,
    userInterests,
    genders = [],
}: {
    profile: ProfileWithRelations;
    allHobbies: HobbyOrInterest[];
    allInterests: HobbyOrInterest[];
    userHobbies: number[];
    userInterests: number[];
    genders?: GenderOption[];
}) {
    const [previewProfile, setPreviewProfile] = useState({
        username: profile.username,
        gender_id: profile.gender_id,
        avatar_id: profile.avatar_id,
        avatar_seed: profile.avatar_seed,
    });

    const currentGenderLabel = genders.find(g => g.id === previewProfile.gender_id)?.label ?? profile.gender?.label ?? "—";

    return (
        <div className="w-full px-6 pt-12 pb-32 sm:pt-16 sm:pl-24">
            <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
                
                {/* Main Profile Shell */}
                <div className="flex flex-col gap-8 rounded-hero border border-star-sapphire/8 bg-surface p-8 shadow-hero sm:p-10">
                    <ProfileHeader profile={{ ...profile, ...previewProfile }} />

                    {/* Basic Meta Grid */}
                    <div className="grid grid-cols-2 gap-4 rounded-2xl border border-star-sapphire/6 bg-bone-100/50 p-5">
                        <div className="flex flex-col items-center text-center">
                            <span className="text-xs font-semibold uppercase tracking-wider text-star-sapphire/60">Age</span>
                            <span className="mt-1 text-lg font-medium text-star-sapphire">{ageFrom(profile.birth_date) ?? "—"}</span>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <span className="text-xs font-semibold uppercase tracking-wider text-star-sapphire/60">Gender</span>
                            <span className="mt-1 text-lg font-medium text-star-sapphire">{currentGenderLabel}</span>
                        </div>
                    </div>

                    <ConfidenceCard level={profile.confidence_level} points={profile.confidence_points ?? 0} />
                </div>

                {/* Modular Cards for Interests, Badges & Settings */}
                <div className="flex flex-col gap-6">
                    <div className="rounded-hero border border-star-sapphire/8 bg-surface p-8 shadow-card sm:p-8">
                        <InterestsEditor
                            hobbies={allHobbies}
                            interests={allInterests}
                            userHobbies={userHobbies}
                            userInterests={userInterests}
                        />
                    </div>

                    <div className="rounded-hero border border-star-sapphire/8 bg-surface p-8 shadow-card sm:p-8">
                        <BadgesSection badges={profile.profile_badges} />
                    </div>

                    <div className="rounded-hero border border-star-sapphire/8 bg-surface p-8 shadow-card sm:p-8">
                        <PrivacySettings
                            profile={profile}
                            genders={genders}
                            onProfilePreview={update => setPreviewProfile(prev => ({ ...prev, ...update }))}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}