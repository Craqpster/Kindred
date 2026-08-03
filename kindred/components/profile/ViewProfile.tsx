import { Lock } from "lucide-react";

import BlockButton from "@/components/profile/BlockButton";
import Avatar from "@/components/ui/Avatar";
import type { ViewableProfile } from "@/lib/profiles";

/// Somebody else's profile, as they have chosen to show it.
///
/// A server component: everything here is already filtered by getViewableProfile, and keeping
/// it off the client means a hidden section is absent from the payload rather than merely
/// unrendered.
export default function ViewProfile({ profile }: { profile: ViewableProfile }) {
    return (
        <article className="mx-auto w-full max-w-2xl">
            <header className="flex flex-col items-center gap-3 py-8 text-center">
                <Avatar
                    name={profile.username}
                    avatarId={profile.avatarId ?? undefined}
                    avatarSeed={profile.avatarSeed ?? undefined}
                    size={96}
                />

                <div>
                    <h1 className="font-display text-title text-ink-900">{profile.username}</h1>

                    {/* Age and gender read as one line because they are one thought, and both
                        are optional — onboarding does not insist on either. */}
                    {(profile.age !== null || profile.gender) && (
                        <p className="mt-0.5 text-meta text-ink-600">
                            {[profile.age, profile.gender].filter(Boolean).join(" · ")}
                        </p>
                    )}
                </div>

                {profile.confidenceLevel !== null && (
                    <p className="rounded-full bg-accent-50 px-3 py-1 text-label uppercase text-accent-600">
                        Confidence tier {profile.confidenceLevel}
                    </p>
                )}

                {/* Never on your own profile: blocking yourself is refused by a CHECK
                    constraint anyway, and offering it would be an odd thing to read. */}
                {!profile.isSelf && (
                    <div className="mt-2">
                        <BlockButton profileId={profile.id} username={profile.username} />
                    </div>
                )}
            </header>

            <Section title="Into" hidden={profile.tags === null}>
                {profile.tags && (
                    <TagList tags={[...profile.tags.hobbies, ...profile.tags.interests]} />
                )}
            </Section>

            <Section title="Badges" hidden={profile.badges === null}>
                {profile.badges &&
                    (profile.badges.length === 0 ? (
                        <p className="text-meta text-ink-600">No badges yet.</p>
                    ) : (
                        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {profile.badges.map((badge) => (
                                <li
                                    key={badge.id}
                                    title={badge.description}
                                    className="flex flex-col items-center gap-1 rounded-card border border-bone-300 bg-surface p-3 text-center shadow-card"
                                >
                                    <span className="text-xl" aria-hidden>
                                        {badge.icon}
                                    </span>
                                    <span className="text-label text-ink-900">{badge.name}</span>
                                </li>
                            ))}
                        </ul>
                    ))}
            </Section>
        </article>
    );
}

/// One block of the profile, or the fact that its owner keeps it to themselves.
///
/// A hidden section still appears, saying so. Omitting it entirely would leave a profile that
/// silently varies in shape from person to person, and a reader cannot tell "has no badges"
/// from "does not show badges" — which are different things about a person.
function Section({
    title,
    hidden,
    children,
}: {
    title: string;
    hidden: boolean;
    children: React.ReactNode;
}) {
    return (
        <section className="border-t border-bone-300 py-6">
            <h2 className="mb-3 text-label uppercase text-ink-600">{title}</h2>

            {hidden ? (
                <p className="flex items-center gap-1.5 text-meta text-ink-600">
                    <Lock size={13} strokeWidth={1.5} aria-hidden />
                    Kept private
                </p>
            ) : (
                children
            )}
        </section>
    );
}

function TagList({ tags }: { tags: string[] }) {
    if (tags.length === 0) {
        return <p className="text-meta text-ink-600">Nothing added yet.</p>;
    }

    return (
        <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
                <li
                    key={tag}
                    className="rounded-full bg-accent-50 px-3 py-1 text-meta text-accent-600"
                >
                    {tag}
                </li>
            ))}
        </ul>
    );
}
