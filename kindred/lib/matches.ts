import "server-only";

import { blockedIdsFor } from "@/lib/blocks";
import type { ProfileWithRelations } from "@/lib/dal";
import { isEaseIn, type EaseIn } from "@/lib/ease-in";
import { prisma } from "@/lib/prisma";

const MAX_MATCHES = 10;

export type Match = {
    id: string;
    username: string;
    avatarId?: string | null;
    avatarSeed?: string | null;
    /// Hobby and interest names the two profiles have in common.
    sharedTags: string[];
    /// Their remaining hobby and interest names — everything not in sharedTags.
    otherTags: string[];
    /// The onboarding ease_in answer both picked, or null if they differ.
    sharedEaseIn: EaseIn | null;
    /// Custom avatar styling.
    avatar_id: string | null;
    avatar_seed: string | null;
};

export async function getMatchesFor(profile: ProfileWithRelations): Promise<Match[]> {
    const myHobbyIds = profile.profile_hobbies.map((row) => row.hobby_id);
    const myInterestIds = profile.profile_interests.map((row) => row.interest_id);

    if (myHobbyIds.length === 0 && myInterestIds.length === 0) return [];

    const connections = await prisma.connections.findMany({
        where: { user_id: profile.id },
        select: { other_id: true },
    });
    // Blocks are excluded alongside people already acted on, and for the same reason: Meet
    // should never offer somebody this person cannot reach. Symmetric, so being blocked hides
    // them from you as well as you from them.
    const blockedIds = await blockedIdsFor(profile.id);

    const excludedIds = [profile.id, ...connections.map((c) => c.other_id), ...blockedIds];

    const myHobbyNames = new Set(profile.profile_hobbies.map((row) => row.hobby.name));
    const myInterestNames = new Set(profile.profile_interests.map((row) => row.interest.name));

    const candidates = await prisma.profiles.findMany({
        where: {
            id: { notIn: excludedIds },
            OR: [
                { profile_hobbies: { some: { hobby_id: { in: myHobbyIds } } } },
                { profile_interests: { some: { interest_id: { in: myInterestIds } } } },
            ],
        },
        include: {
            profile_hobbies: { include: { hobby: true } },
            profile_interests: { include: { interest: true } },
        },
    });

    const scored = candidates.map((candidate) => {
        const theirHobbies = candidate.profile_hobbies.map((row) => row.hobby.name);
        const theirInterests = candidate.profile_interests.map((row) => row.interest.name);

        const sharedTags = [
            ...theirHobbies.filter((name) => myHobbyNames.has(name)),
            ...theirInterests.filter((name) => myInterestNames.has(name)),
        ];

        const otherTags = [
            ...theirHobbies.filter((name) => !myHobbyNames.has(name)),
            ...theirInterests.filter((name) => !myInterestNames.has(name)),
        ];

        const sharedEaseIn =
            isEaseIn(profile.ease_in) && candidate.ease_in === profile.ease_in
                ? profile.ease_in
                : null;

        return {
            match: {
                id: candidate.id,
                username: candidate.username,
                sharedTags,
                otherTags,
                sharedEaseIn,
                avatar_id: candidate.avatar_id,
                avatar_seed: candidate.avatar_seed,
            },
            score: sharedTags.length + (sharedEaseIn ? 1 : 0),
        };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_MATCHES)
        .map((entry) => entry.match);
}