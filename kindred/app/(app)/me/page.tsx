import SignOutForm from "@/components/auth/SignOutForm";
import { requireProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ProfileEditor } from "@/components/profile/ProfileEditor";

export default async function MePage() {
    const [profile, allHobbies, allInterests, genders] = await Promise.all([
        requireProfile(),
        prisma.hobbies.findMany({ orderBy: { name: "asc" } }),
        prisma.interests.findMany({ orderBy: { name: "asc" } }),
        prisma.genders.findMany({ select: { id: true, label: true }, orderBy: { id: "asc" } }),
    ]);

    const userHobbies = profile.profile_hobbies.map(({ hobby_id }) => hobby_id);
    const userInterests = profile.profile_interests.map(({ interest_id }) => interest_id);

    return (
        <div className="mx-auto w-full max-w-2xl px-6 py-10 font-body text-star-sapphire">
            <div className="flex justify-end">
                <SignOutForm />
            </div>

            <div className="mt-4 space-y-12">
                <ProfileEditor
                    profile={profile}
                    allHobbies={allHobbies}
                    allInterests={allInterests}
                    userHobbies={userHobbies}
                    userInterests={userInterests}
                    genders={genders}
                />
            </div>
        </div>
    );
}