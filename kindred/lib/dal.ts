import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

export const getAuthUser = cache(async () => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();

    return user;
});

/// Requires a session. Sends signed-out visitors to log in.
export const verifySession = cache(async () => {
    const user = await getAuthUser();
    if (!user) redirect("/login");
    return { userId: user.id, email: user.email };
});

/// The signed-in user's profile, or null if they have not onboarded yet.
/// Requires a session but does not require a profile — /onboarding needs exactly this.
export const getProfile = cache(async () => {
    const { userId } = await verifySession();

    return prisma.profiles.findUnique({
        where: { id: userId },
        include: {
            gender: true,
            profile_hobbies: { include: { hobby: true } },
            profile_interests: { include: { interest: true } },
            profile_badges: { include: { badge: true } },
        },
    });
});

/// Requires a session AND a completed profile. Use on every surface that assumes a
/// profile exists.
export const requireProfile = cache(async () => {
    const profile = await getProfile();
    if (!profile) redirect("/onboarding");
    return profile;
});

export type ProfileWithRelations = NonNullable<Awaited<ReturnType<typeof getProfile>>>;