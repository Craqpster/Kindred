import { redirect } from "next/navigation";

import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { getProfile, verifySession } from "@/lib/dal";
import { randomHandle } from "@/lib/handles";
import { resolveTags } from "@/lib/onboarding-tags";
import { prisma } from "@/lib/prisma";

export default async function OnboardingPage() {
    await verifySession();

    const profile = await getProfile();
    if (profile) redirect("/profile");

    const [hobbies, interests] = await Promise.all([
        prisma.hobbies.findMany({ select: { id: true, name: true } }),
        prisma.interests.findMany({ select: { id: true, name: true } }),
    ]);

    return (
        <OnboardingWizard
            tags={resolveTags(hobbies, interests)}
            initialHandle={randomHandle()}
        />
    );
}