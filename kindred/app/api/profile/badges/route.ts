import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

const schema = z.object({
  newTier: z.number().int().min(1)
});

export async function PATCH(req: Request) {
  try {
    const { userId } = await verifySession();

    const body = await req.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }

    const { newTier } = result.data;

    // Fetch badges that require this tier or less
    const eligibleBadges = await prisma.badges.findMany({
      where: {
        tierRequirement: {
          lte: newTier,
        }
      }
    });

    // Unlock them for the user
    for (const badge of eligibleBadges) {
      await prisma.profile_badges.upsert({
        where: {
          profile_id_badge_id: {
            profile_id: userId,
            badge_id: badge.id
          }
        },
        create: {
          profile_id: userId,
          badge_id: badge.id
        },
        update: {}
      });
    }

    // Also update the confidence level on the profile
    await prisma.profiles.update({
      where: { id: userId },
      data: { confidence_level: newTier }
    });

    return NextResponse.json({ success: true, unlocked: eligibleBadges.length });
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
