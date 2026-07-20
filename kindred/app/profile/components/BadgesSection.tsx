export function BadgesSection({ profileBadges }: { profileBadges: any[] }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-star-sapphire font-[var(--font-lora)]">Achievements</h2>
        <p className="text-gray-600 text-sm">Badges earned</p>
      </div>

      {profileBadges.length === 0 ? (
        <div className="text-gray-500 text-sm p-4 text-center bg-mist rounded-xl">
          Complete goals to earn badges!
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {profileBadges.map((pb) => {
            const badge = pb.badge;
            return (
              <div
                key={badge.id}
                className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border transition-all duration-300 bg-mist border-mist"
              >
                {badge.icon && <div className="text-3xl mb-2">{badge.icon}</div>}
                <h3 className="font-semibold text-sm text-star-sapphire">
                  {badge.name}
                </h3>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
