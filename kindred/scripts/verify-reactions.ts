// Checks the reaction state machine that the timeline draws from.
//
// applyReaction is the one piece of reaction handling with a real chance of being subtly
// wrong, because three sources drive it and they do not arrive in a fixed order: the
// optimistic click, that click echoed back over realtime, and the server action settling.
// Every one of them re-applies the same end state, so the function has to be idempotent
// rather than a toggle — and "idempotent" is exactly the property that looks fine in review
// and fails in a race.
//
// Needs no database and no network: applyReaction is pure, which is why it was written as a
// value in and a value out rather than as something that reaches into component state.
//
// Run: npm run verify:reactions
import { applyReaction, isReactionPresent } from "../lib/chat/realtime";
import type { ChatMessage } from "../lib/chat/types";

type Check = { name: string; ok: boolean; note?: string };

const checks: Check[] = [];

function expect(name: string, actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    checks.push(a === b ? { name, ok: true } : { name, ok: false, note: `got ${a}, want ${b}` });
}

const message: ChatMessage = {
    id: "m1",
    conversationId: "c1",
    kind: "text",
    body: "hi",
    sender: null,
    replyTo: null,
    promptId: null,
    parentId: null,
    replyCount: 0,
    gameType: null,
    reactions: [],
    createdAt: "2026-07-27T00:00:00.000Z",
    editedAt: null,
    deletedAt: null,
    pinnedAt: null,
};

const mine = { message_id: "m1", profile_id: "u1", emoji: "👍" };
const theirs = { message_id: "m1", profile_id: "u2", emoji: "👍" };

// The straightforward path.
let state = applyReaction([message], mine, true);
expect("adding creates the pill", state[0].reactions, [{ emoji: "👍", reactedBy: ["u1"] }]);

// The optimistic click and its own realtime echo are the same event twice.
state = applyReaction(state, mine, true);
expect("adding twice is idempotent", state[0].reactions, [{ emoji: "👍", reactedBy: ["u1"] }]);

state = applyReaction(state, theirs, true);
expect("a second person joins the pill", state[0].reactions, [
    { emoji: "👍", reactedBy: ["u1", "u2"] },
]);

state = applyReaction(state, mine, false);
expect("removing one leaves the other", state[0].reactions, [{ emoji: "👍", reactedBy: ["u2"] }]);

// A count of zero is not a thing the UI should ever have to render.
state = applyReaction(state, theirs, false);
expect("the last removal drops the pill", state[0].reactions, []);

state = applyReaction(state, mine, false);
expect("removing what is absent is idempotent", state[0].reactions, []);

// Removals are RLS-filtered since 20260903000000 made them an UPDATE, so this no longer
// guards a live leak — but the shell subscription is unfiltered by design, so rows for
// conversations this timeline is not showing still arrive constantly. They must land on
// nothing.
const held = applyReaction([message], mine, true);
expect(
    "a reaction for an unknown message changes nothing",
    applyReaction(held, { message_id: "elsewhere", profile_id: "u9", emoji: "👍" }, true),
    held,
);

let several = applyReaction([message], mine, true);
several = applyReaction(several, { ...mine, emoji: "🎉" }, true);
expect("different emoji coexist", several[0].reactions, [
    { emoji: "👍", reactedBy: ["u1"] },
    { emoji: "🎉", reactedBy: ["u1"] },
]);

// The ordering that actually happens on a slow connection.
let raced = applyReaction([message], mine, true);
raced = applyReaction(raced, mine, true);
raced = applyReaction(raced, mine, true);
expect("optimistic, echo and settle converge", raced[0].reactions, [
    { emoji: "👍", reactedBy: ["u1"] },
]);

// React state is compared by reference, so mutating in place would skip a re-render.
const original: ChatMessage = { ...message, reactions: [] };
applyReaction([original], mine, true);
expect("the input is not mutated", original.reactions, []);

// The soft-delete contract, which is the client half of 20260903000000. The provider maps
// a forwarded row to present/absent through isReactionPresent, and inverting that would turn
// every removal into an add — silently, since both directions render something plausible.
const key = { message_id: "m1", profile_id: "u1", emoji: "👍" };
expect("a live row is present", isReactionPresent({ ...key, deleted_at: null }), true);
expect(
    "a retracted row is absent",
    isReactionPresent({ ...key, deleted_at: "2026-09-03T00:00:00.000Z" }),
    false,
);

// End to end through the pair, in the order two tabs actually see it.
let retracted = applyReaction([message], mine, true);
retracted = applyReaction(retracted, mine, isReactionPresent({ ...key, deleted_at: "2026-09-03T00:00:00.000Z" }));
expect("a retraction drops the pill", retracted[0].reactions, []);

retracted = applyReaction(retracted, mine, isReactionPresent({ ...key, deleted_at: null }));
expect("reacting again after a retraction restores it", retracted[0].reactions, [
    { emoji: "👍", reactedBy: ["u1"] },
]);

retracted = applyReaction(retracted, mine, false);
retracted = applyReaction(retracted, mine, false);
expect("a retraction echoed twice is idempotent", retracted[0].reactions, []);

for (const check of checks) {
    console.log(`${check.ok ? "  ok  " : " FAIL "} ${check.name}${check.note ? ` — ${check.note}` : ""}`);
}

const failed = checks.filter((check) => !check.ok).length;
console.log(`\n${checks.length - failed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
