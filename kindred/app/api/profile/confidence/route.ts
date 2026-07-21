import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const ConfidenceSchema = z.object({
  confidence_level: z.number().min(1).optional(),
  confidence_points: z.number().min(0).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { userId } = await verifySession();
    const body = await req.json();
    const parsed = ConfidenceSchema.parse(body);

    await prisma.profiles.update({
      where: { id: userId },
      data: parsed,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confidence update error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
