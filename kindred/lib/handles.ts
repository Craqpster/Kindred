// Random handle generator for the onboarding "Shuffle" button.
//
// Runs on both sides: the server renders the initial value (so there is no hydration
// mismatch and no empty flash), and the client regenerates on Shuffle. No "server-only".
//
// Deliberately makes no uniqueness guarantee. profiles.username is UNIQUE and the
// action catches P2002 — the index is the authority, not this. A pre-check here would
// be a time-of-check/time-of-use race anyway.

const ADJECTIVES = [
    "quiet", "sunny", "brave", "gentle", "curious", "wandering", "clever", "kind",
    "steady", "bright", "calm", "eager", "honest", "lucky", "mellow", "swift",
];

const NOUNS = [
    "otter", "fox", "heron", "willow", "cedar", "comet", "harbor", "meadow",
    "pebble", "lantern", "compass", "orchard", "river", "sparrow", "thicket", "beacon",
];

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

/// e.g. "quiet_otter_418". Fits the action's 3-20 char [a-zA-Z0-9_] rule.
export function randomHandle(): string {
    const suffix = Math.floor(Math.random() * 900) + 100;
    return `${pick(ADJECTIVES)}_${pick(NOUNS)}_${suffix}`;
}
