import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { tierForPoints } from "@/lib/confidence-tiers";

/// Reconciles the caller's badges with the tier their points have actually earned.
///
/// Takes no body. It used to accept `{ newTier }` and write it straight to
/// confidence_level, which meant any signed-in user could PATCH themselves to any tier
/// and unlock every badge. The tier is not the client's to assert - it is a function of
/// confidence_points, which only lib/confidence.ts may move.
///
/// That makes this endpoint a safety net rather than the mechanism: awardConfidenceForMessage
/// already tiers up and grants badges in one transaction. ConfidenceCard calls this when it
/// notices a tier change so a user whose badges somehow lag behind their points can recover
/// without support intervention.
export async function PATCH() {
  try {
    const { userId } = await verifySession();

    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { confidence_points: true, confidence_level: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const earnedTier = tierForPoints(profile.confidence_points ?? 0);

    const eligibleBadges = await prisma.badges.findMany({
      where: { tierRequirement: { lte: earnedTier } },
    });

    // One transaction, matching lib/confidence.ts: a tier must never be recorded without
    // the badges that go with it, or vice versa.
    await prisma.$transaction(async (tx) => {
      for (const badge of eligibleBadges) {
        await tx.profile_badges.upsert({
          where: { profile_id_badge_id: { profile_id: userId, badge_id: badge.id } },
          create: { profile_id: userId, badge_id: badge.id },
          update: {},
        });
      }

      // Only ever forward. Recomputing could otherwise demote someone if the thresholds
      // are retuned upward later, taking badges they had already been shown.
      if (earnedTier > profile.confidence_level) {
        await tx.profiles.update({
          where: { id: userId },
          data: { confidence_level: earnedTier },
        });
      }
    });

    return NextResponse.json({ success: true, tier: earnedTier, unlocked: eligibleBadges.length });
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
