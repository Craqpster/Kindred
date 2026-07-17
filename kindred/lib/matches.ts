import "server-only";

import type { ProfileWithRelations } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const MAX_MATCHES = 10;

export type Match = {
    id: string;
    username: string;
    /// Hobby and interest names the two profiles have in common.
    sharedTags: string[];
    /// True when both picked the same onboarding ease_in answer.
    sharedEaseIn: boolean;
};

// Candidate pool: everyone who shares at least one hobby or interest, minus the current
// user and anyone they've already acted on (said hi to or dismissed). Scored in JS by
// overlap count + a point for a shared ease_in style. Fine at this scale; if the user
// base grows, replace with a SQL aggregate over the junction tables.
export async function getMatchesFor(profile: ProfileWithRelations): Promise<Match[]> {
    const myHobbyIds = profile.profile_hobbies.map((row) => row.hobby_id);
    const myInterestIds = profile.profile_interests.map((row) => row.interest_id);

    // Nothing in common is possible if they picked no tags at all.
    if (myHobbyIds.length === 0 && myInterestIds.length === 0) return [];

    const connections = await prisma.connections.findMany({
        where: { user_id: profile.id },
        select: { other_id: true },
    });
    const excludedIds = [profile.id, ...connections.map((c) => c.other_id)];

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
        const sharedHobbies = candidate.profile_hobbies
            .map((row) => row.hobby.name)
            .filter((name) => myHobbyNames.has(name));
        const sharedInterests = candidate.profile_interests
            .map((row) => row.interest.name)
            .filter((name) => myInterestNames.has(name));
        const sharedTags = [...sharedHobbies, ...sharedInterests];

        const sharedEaseIn =
            profile.ease_in != null && candidate.ease_in === profile.ease_in;

        return {
            match: { id: candidate.id, username: candidate.username, sharedTags, sharedEaseIn },
            score: sharedTags.length + (sharedEaseIn ? 1 : 0),
        };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_MATCHES)
        .map((entry) => entry.match);
}