import MatchCard from "@/components/meet/MatchCard";
import { requireProfile } from "@/lib/dal";
import { getMatchesFor } from "@/lib/matches";

// Groups are deferred (no formation mechanism yet), so this shows only the 1:1 section.
export default async function MeetPage() {
    const profile = await requireProfile();
    const matches = await getMatchesFor(profile);

    return (
        // sm:pt-20 clears the dock, which is fixed to the top on desktop. It lives here
        // rather than in the layout so /chats can reclaim that height.
        <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:pt-20">
            <h1 className="text-2xl font-bold text-star-sapphire">Meet</h1>
            <p className="mt-1 text-gray-600">
                Start with one or two, you can always meet more.
            </p>

            {matches.length === 0 ? (
                <p className="mt-10 rounded-3xl border border-metro-blue/20 bg-white p-8 text-center text-gray-600">
                    No matches just yet. As more people join and share your hobbies and
                    interests, they&apos;ll show up here.
                </p>
            ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {matches.map((match) => (
                        <MatchCard key={match.id} match={match} />
                    ))}
                </div>
            )}
        </div>
    );
}
