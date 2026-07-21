import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const PrivacySchema = z.object({
  avatar_id: z.string().optional(),
  display_name_mode: z.string().optional(),
  dms_open: z.boolean().optional(),
  show_confidence: z.boolean().optional(),
  show_interests: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const { userId } = await verifySession();
    const body = await req.json();
    const parsed = PrivacySchema.parse(body);

    await prisma.profiles.update({
      where: { id: userId },
      data: parsed,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Privacy update error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
