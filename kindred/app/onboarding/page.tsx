import { redirect } from "next/navigation";

import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { getProfile, verifySession } from "@/lib/dal";
import { randomHandle } from "@/lib/handles";
import { resolveTags } from "@/lib/onboarding-tags";
import { prisma } from "@/lib/prisma";

export default async function OnboardingPage() {
    await verifySession();

    const profile = await getProfile();
    if (profile) redirect("/me");

    const [hobbies, interests, genders] = await Promise.all([
        prisma.hobbies.findMany({ select: { id: true, name: true } }),
        prisma.interests.findMany({ select: { id: true, name: true } }),
        // Seeded by 20260716220111_normalize_profiles; ordered by id so the options keep
        // the order they were seeded in rather than an arbitrary one.
        prisma.genders.findMany({ select: { id: true, label: true }, orderBy: { id: "asc" } }),
    ]);

    return (
        <OnboardingWizard
            tags={resolveTags(hobbies, interests)}
            genders={genders}
            initialHandle={randomHandle()}
        />
    );
}