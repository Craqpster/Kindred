import SignOutForm from "@/components/auth/SignOutForm";
import Avatar from "@/components/ui/Avatar";
import { ageFrom } from "@/lib/age";
import { requireProfile } from "@/lib/dal";

export default async function MePage() {
    const profile = await requireProfile();

    const hobbies = profile.profile_hobbies.map(({ hobby }) => hobby.name);
    const interests = profile.profile_interests.map(({ interest }) => interest.name);

    return (
        <div className="mx-auto w-full max-w-2xl px-6 py-10 font-body text-ink-900">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Avatar name={profile.username} size={56} />
                    <h1 className="font-display text-title">{profile.username}</h1>
                </div>
                <SignOutForm />
            </div>

            <dl className="mt-8 grid grid-cols-[8rem_1fr] gap-y-3 text-body">
                <dt className="text-ink-600">Age</dt>
                <dd>{ageFrom(profile.birth_date) ?? "—"}</dd>

                <dt className="text-ink-600">Gender</dt>
                <dd>{profile.gender?.label ?? "—"}</dd>

                <dt className="text-ink-600">Hobbies</dt>
                <dd>{hobbies.length ? hobbies.join(", ") : "—"}</dd>

                <dt className="text-ink-600">Interests</dt>
                <dd>{interests.length ? interests.join(", ") : "—"}</dd>
            </dl>
        </div>
    );
}