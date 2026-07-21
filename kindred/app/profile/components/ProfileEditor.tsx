"use client";

import { useState } from "react";
import { ageFrom } from "@/lib/age";
import type { ProfileWithRelations } from "@/lib/dal";
import { BadgesSection } from "@/app/profile/components/BadgesSection";
import { ConfidenceCard } from "@/app/profile/components/ConfidenceCard";
import { InterestsEditor } from "@/app/profile/components/InterestsEditor";
import { PrivacySettings } from "@/app/profile/components/PrivacySettings";
import { ProfileHeader } from "@/app/profile/components/ProfileHeader";

type HobbyOrInterest = { id: number; name: string };

// ProfileHeader (the big avatar at the top) and PrivacySettings (the Avatar Style
// picker) are siblings a few components apart - this owns the one piece of state they
// both need so picking a new style shows up immediately, before Save is even clicked.
// Everything else here is just along for the ride so the page's layout stays in one
// piece; only the avatar preview actually cares about this being a client component.
export function ProfileEditor({
    profile,
    allHobbies,
    allInterests,
    userHobbies,
    userInterests,
}: {
    profile: ProfileWithRelations;
    allHobbies: HobbyOrInterest[];
    allInterests: HobbyOrInterest[];
    userHobbies: number[];
    userInterests: number[];
}) {
    const [previewAvatar, setPreviewAvatar] = useState({
        avatar_id: profile.avatar_id,
        avatar_seed: profile.avatar_seed,
    });

    return (
        <>
            <ProfileHeader profile={{ ...profile, ...previewAvatar }} />

            <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-body">
                <dt className="text-ink-600">Age</dt>
                <dd>{ageFrom(profile.birth_date) ?? "—"}</dd>

                <dt className="text-ink-600">Gender</dt>
                <dd>{profile.gender?.label ?? "—"}</dd>
            </dl>

            <div className="space-y-8">
                <ConfidenceCard level={profile.confidence_level} points={profile.confidence_points ?? 0} />
                <BadgesSection profileBadges={profile.profile_badges} />
                <PrivacySettings
                    profile={profile}
                    onAvatarPreview={update => setPreviewAvatar(prev => ({ ...prev, ...update }))}
                />
                <InterestsEditor
                    hobbies={allHobbies}
                    interests={allInterests}
                    userHobbies={userHobbies}
                    userInterests={userInterests}
                />
            </div>
        </>
    );
}
