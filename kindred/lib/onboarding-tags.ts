// The twelve chips on the onboarding "What are you into?" grid.
//
// The grid is one visual cluster, but hobbies and interests are separate tables with
// separate junctions — so each chip has to remember where it came from. `source` is
// what lets the action split one set of checkboxes back into hobby_ids and
// interest_ids.
//
// These twelve are a curated starter set, not the whole catalogue: the lookup tables
// hold ~57 rows for matching and a future "show more". Editing this list changes the
// grid; it does not need a migration, as long as the name exists in the right table.

export type TagSource = "hobby" | "interest";

export type StarterTag = {
    name: string;
    source: TagSource;
};

export const STARTER_TAGS: readonly StarterTag[] = [
    { name: "Indie games", source: "hobby" },
    { name: "Hiking", source: "hobby" },
    { name: "Cooking", source: "hobby" },
    { name: "Anime", source: "interest" },
    { name: "Live music", source: "interest" },
    { name: "Photography", source: "hobby" },
    { name: "Board games", source: "hobby" },
    { name: "Reading", source: "hobby" },
    { name: "Fitness", source: "interest" },
    { name: "Film", source: "interest" },
    { name: "Coffee", source: "interest" },
    { name: "Art", source: "interest" },
];

/// A chip resolved to the row it points at.
export type ResolvedTag = StarterTag & { id: number };

/// Matches each chip to its lookup row by name.
///
/// Throws rather than silently dropping a chip: a name here with no row behind it means
/// the seed and this list have drifted apart, and a quietly short grid is a much worse
/// way to find that out than a loud error.
export function resolveTags(
    hobbies: readonly { id: number; name: string }[],
    interests: readonly { id: number; name: string }[],
): ResolvedTag[] {
    const byName = {
        hobby: new Map(hobbies.map((row) => [row.name, row.id])),
        interest: new Map(interests.map((row) => [row.name, row.id])),
    };

    return STARTER_TAGS.map((tag) => {
        const id = byName[tag.source].get(tag.name);
        if (id === undefined) {
            throw new Error(
                `Onboarding tag "${tag.name}" has no matching ${tag.source} row. ` +
                    `Seed it before adding it to STARTER_TAGS.`,
            );
        }
        return { ...tag, id };
    });
}
