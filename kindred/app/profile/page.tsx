import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

// Prisma connects as the table owner and bypasses RLS, so this session check is the
// only thing guarding the query below. Scope every read by the authenticated id.
export default async function ProfilePage() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/");
    }

    const profile = await prisma.profiles.findUnique({
        where: { id: user.id },
        include: {
            gender: true,
            profile_hobbies: { include: { hobby: true } },
            profile_interests: { include: { interest: true } },
        },
    });

    if (!profile) {
        return (
            <main className="mx-auto max-w-2xl p-8">
                <h1 className="text-2xl font-semibold">Profile</h1>
                <p className="mt-4 opacity-70">
                    You don&apos;t have a profile yet. Finish onboarding to create one.
                </p>
            </main>
        );
    }

    const hobbies = profile.profile_hobbies.map(({ hobby }) => hobby.name);
    const interests = profile.profile_interests.map(({ interest }) => interest.name);

    return (
        <main className="mx-auto max-w-2xl p-8">
            <h1 className="text-2xl font-semibold">{profile.username}</h1>

            <dl className="mt-6 grid grid-cols-[10rem_1fr] gap-y-3">
                <dt className="opacity-60">Age</dt>
                <dd>{ageFrom(profile.birth_date) ?? "—"}</dd>

                <dt className="opacity-60">Gender</dt>
                <dd>{profile.gender?.label ?? "—"}</dd>

                <dt className="opacity-60">Confidence</dt>
                <dd>{profile.confidence_level} / 5</dd>

                <dt className="opacity-60">Hobbies</dt>
                <dd>{hobbies.length ? hobbies.join(", ") : "—"}</dd>

                <dt className="opacity-60">Interests</dt>
                <dd>{interests.length ? interests.join(", ") : "—"}</dd>
            </dl>
        </main>
    );
}

// Age is computed rather than stored: a stored age is wrong within a year.
function ageFrom(birthDate: Date | null): number | null {
    if (!birthDate) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
    }
    return age;
}
