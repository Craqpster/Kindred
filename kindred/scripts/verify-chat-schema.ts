// Checks that the chat schema enforces what it claims to.
//
// Three of its guarantees are invisible from the application side: CHECK constraints, the
// last_message_at trigger, and the RLS policies. The policies especially - Prisma connects
// as the table owner, and an owner bypasses RLS entirely, so a test that queried the way the
// app does would pass no matter what the policies said. Everything below runs as the
// `authenticated` role with an impersonated auth.uid(), which is what Supabase Realtime
// evaluates when it decides what to send a subscriber.
//
// Safe against a live database: every test runs in a transaction that is always rolled back,
// and real profile rows are borrowed as actors rather than created (profiles are foreign-keyed
// to auth.users, which is not worth forging for a test).
//
// Run: npm run verify:chat
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

type Actor = { id: string; username: string };
type Check = { name: string; ok: boolean; note?: string };

const ok = (name: string): Check => ({ name, ok: true });
const not = (name: string, note: string): Check => ({ name, ok: false, note });

/// Carries its body's return value out through the exception that rolls the transaction back.
/// Prisma rolls back when the callback throws, so throwing IS the commit-free exit.
class Rollback<T> extends Error {
    constructor(readonly value: T) {
        super("intentional rollback");
    }
}

async function rolledBack<T>(body: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
        await prisma.$transaction(async (tx) => {
            throw new Rollback(await body(tx));
        });
    } catch (error) {
        if (error instanceof Rollback) return error.value as T;
        throw error;
    }
    throw new Error("unreachable: the transaction always throws");
}

/// Becomes the authenticated browser role for the rest of the transaction, as `userId`.
///
/// set_config rather than `SET LOCAL request.jwt.claims = '...'` because SET takes no bind
/// parameters, and building that string by hand is how a test starts lying about what it
/// tested. auth.uid() reads exactly this setting.
async function actAs(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`;
}

async function actAsOwner(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`RESET ROLE`;
}

async function countOf(tx: Prisma.TransactionClient, query: Prisma.Sql): Promise<number> {
    const [row] = await tx.$queryRaw<{ n: bigint }[]>(query);
    return Number(row.n);
}

// --- fixtures -------------------------------------------------------------------------

/// The DM key for a pair: least:greatest, so the same two people always produce the same
/// string. The unique index on it is what turns that into "one conversation per pair".
const dmKeyFor = (a: Actor, b: Actor) => [a.id, b.id].sort().join(":");

async function createDm(tx: Prisma.TransactionClient, dmKey: string): Promise<string> {
    const [row] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO conversations (kind, dm_key) VALUES ('dm', ${dmKey}) RETURNING id;
    `;
    return row.id;
}

async function sendMessage(
    tx: Prisma.TransactionClient,
    conversationId: string,
    senderId: string | null,
    body: string,
    kind = "text",
): Promise<string> {
    const [row] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO messages (conversation_id, sender_id, kind, body)
        VALUES (${conversationId}::uuid, ${senderId}::uuid, ${kind}, ${body})
        RETURNING id;
    `;
    return row.id;
}

// --- malformed rows must be impossible ------------------------------------------------

type Rejection = {
    name: string;
    /// The constraint expected to do the rejecting. Naming it is what stops a test from
    /// passing because the write happened to fail for some unrelated reason.
    constraint: string;
    attempt: (tx: Prisma.TransactionClient, alice: Actor, dmKey: string) => Promise<unknown>;
};

const REJECTIONS: Rejection[] = [
    {
        name: "a DM without a dm_key",
        constraint: "conversations_shape_check",
        attempt: (tx) => tx.$executeRaw`INSERT INTO conversations (kind) VALUES ('dm')`,
    },
    {
        name: "a group without a title",
        constraint: "conversations_shape_check",
        attempt: (tx) => tx.$executeRaw`
            INSERT INTO conversations (kind, group_id) VALUES ('group', gen_random_uuid())
        `,
    },
    {
        name: "an unknown conversation kind",
        constraint: "conversations_kind_check",
        attempt: (tx) => tx.$executeRaw`
            INSERT INTO conversations (kind, dm_key) VALUES ('channel', 'a:b')
        `,
    },
    {
        name: "half a wave — a requester with nobody requested of",
        constraint: "conversations_request_check",
        attempt: (tx, alice) => tx.$executeRaw`
            INSERT INTO conversations (kind, dm_key, requested_by)
            VALUES ('dm', 'a:b', ${alice.id}::uuid)
        `,
    },
    {
        name: "a second DM for a pair that already has one",
        constraint: "conversations_dm_key_key",
        attempt: async (tx, _alice, dmKey) => {
            await createDm(tx, dmKey);
            await createDm(tx, dmKey);
        },
    },
    {
        name: "a plain message secretly carrying a prompt_id",
        constraint: "messages_kind_fields_check",
        attempt: async (tx, alice, dmKey) => {
            const conversationId = await createDm(tx, dmKey);
            const promptId = await sendMessage(tx, conversationId, alice.id, "q?", "icebreaker_prompt");
            await tx.$executeRaw`
                INSERT INTO messages (conversation_id, sender_id, kind, body, prompt_id)
                VALUES (${conversationId}::uuid, ${alice.id}::uuid, 'text', 'an answer', ${promptId}::uuid)
            `;
        },
    },
    {
        name: "an unknown message kind",
        constraint: "messages_kind_check",
        attempt: async (tx, alice, dmKey) => {
            const conversationId = await createDm(tx, dmKey);
            await sendMessage(tx, conversationId, alice.id, "hi", "voice_note");
        },
    },
];

async function checkRejections(alice: Actor, dmKey: string): Promise<Check[]> {
    const checks: Check[] = [];

    for (const { name, constraint, attempt } of REJECTIONS) {
        try {
            await rolledBack((tx) => attempt(tx, alice, dmKey));
            checks.push(not(name, "was ACCEPTED — the constraint is not doing its job"));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            checks.push(
                message.includes(constraint)
                    ? ok(name)
                    : not(name, `rejected, but not by ${constraint}: ${message.split("\n")[0]}`),
            );
        }
    }

    return checks;
}

// --- the trigger ----------------------------------------------------------------------

async function checkTrigger(alice: Actor, dmKey: string): Promise<Check[]> {
    return rolledBack(async (tx) => {
        const conversationId = await createDm(tx, dmKey);

        const lastMessageAt = async () => {
            const [row] = await tx.$queryRaw<{ last_message_at: Date | null }[]>`
                SELECT last_message_at FROM conversations WHERE id = ${conversationId}::uuid;
            `;
            return row.last_message_at;
        };

        const onCreation = await lastMessageAt();
        await sendMessage(tx, conversationId, alice.id, "first");
        const afterFirst = await lastMessageAt();

        // Backdated on purpose: an older message must not drag the timestamp backwards, or a
        // backfill would silently reshuffle everyone's chat list.
        await tx.$executeRaw`
            INSERT INTO messages (conversation_id, sender_id, body, created_at)
            VALUES (${conversationId}::uuid, ${alice.id}::uuid, 'older', now() - interval '1 day');
        `;
        const afterBackdated = await lastMessageAt();

        await sendMessage(tx, conversationId, null, "What are you into?", "icebreaker_prompt");
        const fromBot = await countOf(
            tx,
            Prisma.sql`SELECT count(*) AS n FROM messages
                       WHERE conversation_id = ${conversationId}::uuid AND sender_id IS NULL`,
        );

        return [
            onCreation === null
                ? ok("a new conversation starts with no last_message_at")
                : not("a new conversation starts with no last_message_at", `was ${onCreation}`),
            afterFirst !== null
                ? ok("sending a message sets last_message_at")
                : not("sending a message sets last_message_at", "still null"),
            afterBackdated?.getTime() === afterFirst?.getTime()
                ? ok("a backdated message does not move it backwards")
                : not("a backdated message does not move it backwards", `moved to ${afterBackdated}`),
            fromBot === 1
                ? ok("the Kindred bot can post with no sender_id")
                : not("the Kindred bot can post with no sender_id", `found ${fromBot}`),
        ];
    });
}

// --- row level security ---------------------------------------------------------------

/// What one person can actually see and do, asked as the browser role rather than as the
/// owner. This is the whole point of the file.
type Visibility = {
    conversations: number;
    messages: number;
    reactions: number;
    writeRejected: boolean;
};

async function visibilityFor(
    tx: Prisma.TransactionClient,
    userId: string,
    conversationId: string,
    messageId: string,
): Promise<Visibility> {
    await actAs(tx, userId);

    const conversations = await countOf(
        tx,
        Prisma.sql`SELECT count(*) AS n FROM conversations WHERE id = ${conversationId}::uuid`,
    );
    const messages = await countOf(
        tx,
        Prisma.sql`SELECT count(*) AS n FROM messages WHERE conversation_id = ${conversationId}::uuid`,
    );
    const reactions = await countOf(
        tx,
        Prisma.sql`SELECT count(*) AS n FROM message_reactions WHERE message_id = ${messageId}::uuid`,
    );

    // Behind a savepoint so the expected rejection doesn't poison the transaction the rest
    // of the checks are still running in.
    let writeRejected = false;
    await tx.$executeRaw`SAVEPOINT attempted_write`;
    try {
        await sendMessage(tx, conversationId, userId, "written straight from the browser");
        await tx.$executeRaw`RELEASE SAVEPOINT attempted_write`;
    } catch {
        writeRejected = true;
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT attempted_write`;
    }

    await actAsOwner(tx);
    return { conversations, messages, reactions, writeRejected };
}

/// Presence and typing ride a private channel per conversation, authorized by RLS on
/// realtime.messages rather than on any table of ours — there is no row behind a broadcast to
/// check. can_use_conversation_channel is what those policies call, so testing it is testing
/// who can join.
///
/// The garbage case matters as much as the other two: the topic is a client-supplied string,
/// and an uncaught `topic::uuid` would turn a malformed join into a raised error instead of a
/// refusal.
async function checkConversationChannels(
    alice: Actor,
    bob: Actor,
    carol: Actor,
    dmKey: string,
): Promise<Check[]> {
    return rolledBack(async (tx) => {
        const conversationId = await createDm(tx, dmKey);
        await tx.$executeRaw`
            INSERT INTO conversation_members (conversation_id, profile_id)
            VALUES (${conversationId}::uuid, ${alice.id}::uuid),
                   (${conversationId}::uuid, ${bob.id}::uuid);
        `;

        async function mayJoin(userId: string, topic: string) {
            await actAs(tx, userId);
            const [row] = await tx.$queryRaw<{ allowed: boolean }[]>`
                SELECT public.can_use_conversation_channel(${topic}) AS allowed;
            `;
            await actAsOwner(tx);
            return row.allowed;
        }

        return [
            (await mayJoin(alice.id, conversationId))
                ? ok("a member may join their conversation's channel")
                : not("a member may join their conversation's channel", "refused"),
            !(await mayJoin(carol.id, conversationId))
                ? ok("an outsider may not join it")
                : not("an outsider may not join it", "allowed — presence and typing would leak"),
            !(await mayJoin(alice.id, "not-a-uuid"))
                ? ok("a malformed topic is refused, not an error")
                : not("a malformed topic is refused, not an error", "allowed"),
        ];
    });
}

async function checkRowLevelSecurity(
    alice: Actor,
    bob: Actor,
    carol: Actor,
    dmKey: string,
): Promise<Check[]> {
    return rolledBack(async (tx) => {
        const conversationId = await createDm(tx, dmKey);
        await tx.$executeRaw`
            INSERT INTO conversation_members (conversation_id, profile_id)
            VALUES (${conversationId}::uuid, ${alice.id}::uuid),
                   (${conversationId}::uuid, ${bob.id}::uuid);
        `;
        const messageId = await sendMessage(tx, conversationId, alice.id, "a private thing");
        await tx.$executeRaw`
            INSERT INTO message_reactions (message_id, profile_id, emoji)
            VALUES (${messageId}::uuid, ${bob.id}::uuid, '👍');
        `;

        // Without this grant the policies are unreachable and every count below reads zero -
        // which would look like watertight security and is really a silent outage.
        const [{ granted }] = await tx.$queryRaw<{ granted: boolean }[]>`
            SELECT has_table_privilege('authenticated', 'public.messages', 'SELECT') AS granted;
        `;

        const member = await visibilityFor(tx, alice.id, conversationId, messageId);
        const outsider = await visibilityFor(tx, carol.id, conversationId, messageId);

        const sees = (who: string, what: string, actual: number, expected: number) =>
            actual === expected
                ? ok(`${who} sees ${expected === 0 ? "no" : "their"} ${what}`)
                : not(`${who} sees ${expected === 0 ? "no" : "their"} ${what}`, `saw ${actual}`);

        return [
            granted
                ? ok("the authenticated role is granted SELECT")
                : not("the authenticated role is granted SELECT", "no grant — realtime would be silent"),
            sees("a member", "conversation", member.conversations, 1),
            sees("a member", "messages", member.messages, 1),
            sees("a member", "reactions", member.reactions, 1),
            sees("an outsider", "conversation", outsider.conversations, 0),
            sees("an outsider", "messages", outsider.messages, 0),
            sees("an outsider", "reactions", outsider.reactions, 0),
            member.writeRejected
                ? ok("a member still cannot write from the browser role")
                : not("a member still cannot write from the browser role", "the INSERT went through"),
            outsider.writeRejected
                ? ok("an outsider cannot write either")
                : not("an outsider cannot write either", "the INSERT went through"),
        ];
    });
}

// --- the tests must not have left anything behind -------------------------------------

type RowCounts = Record<string, bigint>;

/// How many rows the chat tables hold right now.
async function countChatRows(): Promise<RowCounts> {
    const [counts] = await prisma.$queryRaw<RowCounts[]>`
        SELECT (SELECT count(*) FROM conversations)        AS conversations,
               (SELECT count(*) FROM conversation_members) AS members,
               (SELECT count(*) FROM messages)             AS messages,
               (SELECT count(*) FROM message_reactions)    AS reactions;
    `;
    return counts;
}

/// Runs last. Everything above writes real rows and relies on the rollback in `rolledBack`
/// to take them away again - which is a claim about this file's own machinery, not about the
/// schema, and is therefore exactly the kind of thing that should be checked rather than
/// assumed.
///
/// Before-and-after rather than "the tables are empty". The original version asserted zero,
/// which was true only while nothing but this script wrote here; the moment the app created
/// its first real conversation it began reporting a person's actual chats as leaked test
/// rows. A delta measures what this run did and is indifferent to what was already there,
/// which is the property that was actually wanted all along.
///
/// It does mean a chat arriving from a real user mid-run reads as a leak. That is the right
/// way round: a false alarm costs a second look, where the alternative — a filter clever
/// enough to ignore other people's rows — could hide a genuine leak behind it.
function checkNothingPersisted(before: RowCounts, after: RowCounts): Check[] {
    return Object.keys(after).map((table) => {
        const delta = Number(after[table]) - Number(before[table]);

        if (delta === 0) return ok(`no ${table} left behind`);
        if (delta > 0) return not(`no ${table} left behind`, `${delta} rows added by this run`);
        return not(`no ${table} left behind`, `${-delta} rows disappeared during this run`);
    });
}

// --- runner ---------------------------------------------------------------------------

function print(heading: string, checks: Check[]): void {
    console.log(`\n${heading}`);
    for (const check of checks) {
        console.log(`  ${check.ok ? "PASS" : "FAIL"}  ${check.name}${check.note ? ` — ${check.note}` : ""}`);
    }
}

async function main(): Promise<void> {
    const actors = await prisma.$queryRaw<Actor[]>`
        SELECT id, username FROM profiles ORDER BY created_at LIMIT 3;
    `;
    if (actors.length < 3) {
        throw new Error(`Need 3 profiles to test with, found ${actors.length}.`);
    }

    const [alice, bob, carol] = actors;
    const dmKey = dmKeyFor(alice, bob);
    console.log(`${alice.username} and ${bob.username} share a chat. ${carol.username} does not.`);

    // Taken before anything writes, so the last group can measure this run rather than
    // judging whatever the database already held.
    const before = await countChatRows();

    const groups: [string, Check[]][] = [
        ["Malformed rows must be impossible:", await checkRejections(alice, dmKey)],
        ["last_message_at must track the newest message:", await checkTrigger(alice, dmKey)],
        ["RLS must show each person only their own chats:", await checkRowLevelSecurity(alice, bob, carol, dmKey)],
        ["Conversation channels must only admit members:", await checkConversationChannels(alice, bob, carol, dmKey)],
        ["The run itself must be invisible:", checkNothingPersisted(before, await countChatRows())],
    ];

    const checks = groups.flatMap(([, group]) => group);
    for (const [heading, group] of groups) print(heading, group);

    const failed = checks.filter((check) => !check.ok).length;
    console.log(`\n${checks.length - failed} passed, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
