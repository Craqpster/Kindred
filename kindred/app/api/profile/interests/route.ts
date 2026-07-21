import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const InterestsSchema = z.object({
  hobbyIds: z.array(z.number()),
  interestIds: z.array(z.number()),
});

export async function PATCH(req: Request) {
  try {
    const { userId } = await verifySession();
    const body = await req.json();
    const parsed = InterestsSchema.parse(body);

    await prisma.$transaction([
      prisma.profile_hobbies.deleteMany({ where: { profile_id: userId } }),
      prisma.profile_interests.deleteMany({ where: { profile_id: userId } }),
      
      prisma.profile_hobbies.createMany({
        data: parsed.hobbyIds.map(id => ({ profile_id: userId, hobby_id: id })),
      }),
      prisma.profile_interests.createMany({
        data: parsed.interestIds.map(id => ({ profile_id: userId, interest_id: id })),
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Interests update error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
