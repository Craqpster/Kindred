import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import type { ProfileWithRelations } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/// Groups are 3-4 people
const GROUP_SIZE_MAX = 4;
const GROUP_SIZE_MIN = 3;

export type GroupMember = {
    id: string;
    username: string;
};

export type Group = {
    id: string;
    title: string;
    /// NULL while the Stream channel has not been created yet — see the schema comment
    /// on groups.stream_channel_id. The card renders a repair state for this.
    streamChannelId: string | null;
    members: GroupMember[];
};

/// Why a group could not be formed. Carried rather than thrown so the caller can pick
/// copy per case: these are all ordinary outcomes, not errors.
export type FormGroupFailure =
    /// They picked no hobbies or interests, so there is nothing to group them on.
    | "no_tags"
    /// Fewer than GROUP_SIZE_MIN - 1 ungrouped people share a tag with them.
    | "not_enough_people"
    /// Someone we selected was grouped by a concurrent request. Retryable as-is.
    | "race";

export type FormGroupResult =
    | { ok: true; group: Group }
    | { ok: false; reason: FormGroupFailure };

class GroupRaceError extends Error {}

type TaggedProfile = {
    profile_hobbies: { hobby: { name: string } }[];
    profile_interests: { interest: { name: string } }[];
};

function tagNamesOf(profile: TaggedProfile): Set<string> {
    return new Set([
        ...profile.profile_hobbies.map((row) => row.hobby.name),
        ...profile.profile_interests.map((row) => row.interest.name),
    ]);
}

function overlapCount(a: Set<string>, b: Set<string>): number {
    let n = 0;
    for (const name of a) if (b.has(name)) n++;
    return n;
}

/// The group this profile belongs to, or null. Everyone has at most one — the invariant
/// lives on group_members' primary key.
export async function getGroupFor(profileId: string): Promise<Group | null> {
    const membership = await prisma.group_members.findUnique({
        where: { profile_id: profileId },
        include: {
            group: {
                include: {
                    members: {
                        include: { profile: { select: { id: true, username: true } } },
                        orderBy: { joined_at: "asc" },
                    },
                },
            },
        },
    });

    if (!membership) return null;

    const { group } = membership;
    return {
        id: group.id,
        title: group.title,
        streamChannelId: group.stream_channel_id,
        members: group.members.map((row) => row.profile),
    };
}

/// Picks 2-3 ungrouped people who share the most tags with `profile` (and with each
/// other), and commits them all into a new group.
export async function formGroupFor(profile: ProfileWithRelations): Promise<FormGroupResult> {
    const myTags = tagNamesOf(profile);
    if (myTags.size === 0) return { ok: false, reason: "no_tags" };

    const myHobbyIds = profile.profile_hobbies.map((row) => row.hobby_id);
    const myInterestIds = profile.profile_interests.map((row) => row.interest_id);

    const pool = await prisma.profiles.findMany({
        where: {
            id: { not: profile.id },
            group_member: { is: null },
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

    if (pool.length < GROUP_SIZE_MIN - 1) {
        return { ok: false, reason: "not_enough_people" };
    }

    const remaining = pool.map((candidate) => ({
        profile: candidate,
        tags: tagNamesOf(candidate),
    }));
    const picked = [{ id: profile.id, username: profile.username, tags: myTags }];

    while (picked.length < GROUP_SIZE_MAX && remaining.length > 0) {
        let bestIndex = 0;
        let bestScore = -1;

        for (let i = 0; i < remaining.length; i++) {
            const candidate = remaining[i];
            let score = 0;
            for (const member of picked) score += overlapCount(candidate.tags, member.tags);

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
                continue;
            }
            if (score < bestScore) continue;

            const best = remaining[bestIndex];
            const byDate =
                candidate.profile.created_at.getTime() - best.profile.created_at.getTime();
            if (byDate < 0 || (byDate === 0 && candidate.profile.id < best.profile.id)) {
                bestIndex = i;
            }
        }

        const [chosen] = remaining.splice(bestIndex, 1);
        picked.push({
            id: chosen.profile.id,
            username: chosen.profile.username,
            tags: chosen.tags,
        });
    }

    if (picked.length < GROUP_SIZE_MIN) {
        return { ok: false, reason: "not_enough_people" };
    }

    const title = titleFor(picked.map((member) => member.tags));
    const memberIds = picked.map((member) => member.id);

    try {
        const created = await prisma.$transaction(async (tx) => {
            const taken = await tx.group_members.findMany({
                where: { profile_id: { in: memberIds } },
                select: { profile_id: true },
            });
            if (taken.length > 0) throw new GroupRaceError();

            const group = await tx.groups.create({ data: { title } });

            await tx.group_members.createMany({
                data: memberIds.map((profile_id) => ({ profile_id, group_id: group.id })),
            });

            return group;
        });

        return {
            ok: true,
            group: {
                id: created.id,
                title: created.title,
                streamChannelId: created.stream_channel_id,
                members: picked.map(({ id, username }) => ({ id, username })),
            },
        };
    } catch (error) {
        if (error instanceof GroupRaceError) return { ok: false, reason: "race" };

        // group_members_pkey is the only unique index this transaction can violate, so
        // the code alone identifies it — just as well, since Prisma 7 dropped
        // error.meta.target (see app/onboarding/actions.ts for that story).
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            return { ok: false, reason: "race" };
        }
        throw error;
    }
}

/// The group's name: the tag its members most have in common.
///
/// A tag everyone holds beats a merely popular one, so "Hiking" means all four hike
/// rather than two of them. Only on a genuine tie do two names appear — a runner-up that
/// is merely close would make the title longer without making it truer.
function titleFor(memberTags: Set<string>[]): string {
    const counts = new Map<string, number>();
    for (const tags of memberTags) {
        for (const name of tags) counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const universal = [...counts].filter(([, n]) => n === memberTags.length);
    const ranked = (universal.length > 0 ? universal : [...counts]).sort(
        // Alphabetical within a tie so the same membership never yields two titles.
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );

    // Only reachable if every member is untagged, which formGroupFor already refuses —
    // kept so this function is total on its own terms rather than on its caller's.
    if (ranked.length === 0) return "Your group";

    if (ranked[1] && ranked[1][1] === ranked[0][1]) {
        return `${ranked[0][0]} & ${ranked[1][0]}`;
    }
    return ranked[0][0];
}