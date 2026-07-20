import SignOutForm from "@/components/auth/SignOutForm";
import { requireProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
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
    <div className="mx-auto w-full max-w-2xl px-6 py-10 text-ink">
      <div className="flex justify-end mb-6">
        <SignOutForm />
      </div>
      
      <div className="space-y-12">
        <ProfileHeader profile={profile} />
        
        <div className="space-y-8">
          <ConfidenceCard 
            level={profile.confidence_level} 
            points={profile.confidence_points || 0} 
          />
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