import "server-only";

import { ageFrom } from "@/lib/age";
import { isBlockedBetween } from "@/lib/blocks";
import { prisma } from "@/lib/prisma";

// Viewing somebody else's profile.
//
// Two questions, answered in this order and never merged: **may this person see the profile at
// all**, and then **which parts of it has the owner chosen to show**. Collapsing them is how a
// hidden field ends up in a payload that the client is merely trusted not to render.
//
// The privacy flags were write-only until this file existed. You could turn "Show Confidence
// Tier" off and nothing changed, because nothing read it — the settings promised a control
// they did not have. Everything below is what makes them true.

/// A profile as somebody else is allowed to see it.
///
/// Hidden sections arrive as null rather than as empty arrays. The difference matters to the
/// UI: nothing to show and choosing not to show it are different sentences, and only one of
/// them should say "hasn't added any interests yet".
export type ViewableProfile = {
    id: string;
    username: string;
    avatarId: string | null;
    avatarSeed: string | null;
    age: number | null;
    gender: string | null;
    /// null when show_confidence is off.
    confidenceLevel: number | null;
    /// null when show_badges is off.
    badges: { id: string; name: string; description: string; icon: string | null }[] | null;
    /// null when show_interests is off.
    tags: { hobbies: string[]; interests: string[] } | null;
    /// Whether a wave would be accepted, so Meet can say so before somebody tries.
    dmsOpen: boolean;
    /// True when the viewer is looking at themselves — they see everything regardless of
    /// their own switches, because hiding your profile from yourself is not a feature.
    isSelf: boolean;
};

/// Whether `viewerId` is allowed to open `targetId`'s profile at all.
///
/// Two ways in, matching the two places a profile is reachable from:
///
///   * you share a conversation — they are someone you are already talking to;
///   * you share a hobby or interest — they can appear on your Meet cards, and deciding
///     whether to wave is exactly what the profile is for.
///
/// The second is Meet's own eligibility rule minus the "already acted on" exclusion, so
/// somebody you greeted and then archived stays viewable rather than becoming a stranger.
///
/// Everyone else gets nothing. Not a 403 — the caller turns this into "no such profile", so
/// a stranger cannot tell an account that exists from one that does not.
async function canView(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) return true;

    // Checked first, and it overrides everything below. A block has to beat the shared-tag and
    // shared-conversation rules, or blocking somebody you are already talking to would leave
    // their profile open to you and yours to them.
    if (await isBlockedBetween(viewerId, targetId)) return false;

    const sharedConversation = await prisma.conversation_members.findFirst({
        where: {
            profile_id: viewerId,
            conversation: { members: { some: { profile_id: targetId } } },
        },
        select: { profile_id: true },
    });

    if (sharedConversation) return true;

    // The viewer's own tags first, because "shared" is defined relative to them. Same shape
    // getMatchesFor uses to build its candidate pool, so the two agree on who is reachable.
    const viewer = await prisma.profiles.findUnique({
        where: { id: viewerId },
        select: {
            profile_hobbies: { select: { hobby_id: true } },
            profile_interests: { select: { interest_id: true } },
        },
    });

    const hobbyIds = viewer?.profile_hobbies.map((row) => row.hobby_id) ?? [];
    const interestIds = viewer?.profile_interests.map((row) => row.interest_id) ?? [];

    // Someone who has picked nothing shares nothing, so they can only reach profiles through
    // a conversation. That matches Meet, which shows them no cards either.
    if (hobbyIds.length === 0 && interestIds.length === 0) return false;

    const sharedTag = await prisma.profiles.findFirst({
        where: {
            id: targetId,
            OR: [
                { profile_hobbies: { some: { hobby_id: { in: hobbyIds } } } },
                { profile_interests: { some: { interest_id: { in: interestIds } } } },
            ],
        },
        select: { id: true },
    });

    return !!sharedTag;
}

/// One profile, as this viewer may see it. Null when they may not see it at all.
export async function getViewableProfile(
    viewerId: string,
    targetId: string,
): Promise<ViewableProfile | null> {
    if (!(await canView(viewerId, targetId))) return null;

    const profile = await prisma.profiles.findUnique({
        where: { id: targetId },
        include: {
            gender: true,
            profile_hobbies: { include: { hobby: true } },
            profile_interests: { include: { interest: true } },
            profile_badges: { include: { badge: true } },
        },
    });

    if (!profile) return null;

    const isSelf = viewerId === targetId;
    // Your own switches never hide anything from you — otherwise turning one off would make
    // it impossible to check what you had turned off.
    const shows = (flag: boolean | null) => isSelf || (flag ?? true);

    return {
        id: profile.id,
        username: profile.username,
        avatarId: profile.avatar_id,
        avatarSeed: profile.avatar_seed,
        // Derived, never stored — see lib/age.ts. The birth date itself is not in this shape
        // at all, so a hidden age cannot leak through a payload nobody rendered.
        age: profile.birth_date ? ageFrom(profile.birth_date) : null,
        gender: profile.gender?.label ?? null,
        confidenceLevel: shows(profile.show_confidence) ? profile.confidence_level : null,
        badges: shows(profile.show_badges)
            ? profile.profile_badges.map((row) => ({
                  id: row.badge.id,
                  name: row.badge.name,
                  description: row.badge.description,
                  icon: row.badge.icon,
              }))
            : null,
        tags: shows(profile.show_interests)
            ? {
                  hobbies: profile.profile_hobbies.map((row) => row.hobby.name),
                  interests: profile.profile_interests.map((row) => row.interest.name),
              }
            : null,
        dmsOpen: profile.dms_open ?? true,
        isSelf,
    };
}
