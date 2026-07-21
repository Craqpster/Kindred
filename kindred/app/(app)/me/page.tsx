import SignOutForm from "@/components/auth/SignOutForm";
import { requireProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ageFrom } from "@/lib/age";
import { ProfileHeader } from "@/app/profile/components/ProfileHeader";
import { ConfidenceCard } from "@/app/profile/components/ConfidenceCard";
import { BadgesSection } from "@/app/profile/components/BadgesSection";
import { InterestsEditor } from "@/app/profile/components/InterestsEditor";
import { PrivacySettings } from "@/app/profile/components/PrivacySettings";

export default async function MePage() {
  const profile = await requireProfile();

  // Fetch a limited number of hobbies and interests to avoid clutter
  const allHobbies = await prisma.hobbies.findMany({ orderBy: { name: 'asc' } });
  const allInterests = await prisma.interests.findMany({ orderBy: { name: 'asc' } });

  const userHobbies = profile.profile_hobbies.map(ph => ph.hobby_id);
  const userInterests = profile.profile_interests.map(pi => pi.interest_id);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 font-body text-ink-900">
      <div className="flex justify-end">
        <SignOutForm />
      </div>

      <div className="mt-4 space-y-12">
        <ProfileHeader profile={profile} />

        <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-body">
          <dt className="text-ink-600">Age</dt>
          <dd>{ageFrom(profile.birth_date) ?? "—"}</dd>

          <dt className="text-ink-600">Gender</dt>
          <dd>{profile.gender?.label ?? "—"}</dd>
        </dl>

        <div className="space-y-8">
          <ConfidenceCard level={profile.confidence_level} points={profile.confidence_points || 0} />
          <BadgesSection profileBadges={profile.profile_badges || []} />
          <PrivacySettings profile={profile} />
          <InterestsEditor
            hobbies={allHobbies}
            interests={allInterests}
            userHobbies={userHobbies}
            userInterests={userInterests}
          />
        </div>
      </div>
    </div>
  );
}