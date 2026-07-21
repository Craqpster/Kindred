import { ProfileWithRelations } from "@/lib/dal";
import * as Avatar from "@radix-ui/react-avatar";

export function ProfileHeader({ profile }: { profile: any }) {
  const style = profile.avatar_id || "adventurer";
  const avatarUrl = `https://api.dicebear.com/9.x/${style}/svg?seed=${profile.username}`;
  const tier = profile.confidence_level;
  
  const earnedBadgesCount = profile.profile_badges?.length || 0;

  return (
    <div className="flex flex-col items-center">
      <Avatar.Root className="w-28 h-28 rounded-full overflow-hidden mb-4 bg-mist flex items-center justify-center">
        <Avatar.Image
          className="w-full h-full object-cover"
          src={avatarUrl}
          alt={profile.username}
        />
        <Avatar.Fallback
          className="text-star-sapphire text-3xl font-bold"
          delayMs={600}
        >
          {profile.username.substring(0, 2).toUpperCase()}
        </Avatar.Fallback>
      </Avatar.Root>
      
      <h1 className="text-3xl font-bold text-star-sapphire mb-1 font-[var(--font-lora)]">@{profile.username}</h1>
      {profile.display_name_mode === "real" && (
        <p className="text-gray-600 mb-4">{profile.username}</p>
      )}

      <div className="flex gap-3 mt-3">
        <div className="bg-iceland/20 text-metro-blue px-4 py-1.5 rounded-full text-sm font-medium">
          Tier {tier}
        </div>
        <div className="bg-mist text-star-sapphire px-4 py-1.5 rounded-full text-sm font-medium">
          {earnedBadgesCount} Badges
        </div>
      </div>
    </div>
  );
}
