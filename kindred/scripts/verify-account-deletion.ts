import "dotenv/config";

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";
import { deleteAccount } from "../lib/account";

// Proves that deleting an account really does erase it, and really does leave everyone else
// alone. Worth a script rather than a click-through because the operation is irreversible:
// there is no way to test it by hand without destroying a real account.
//
// Unlike verify:chat, this writes. It builds two throwaway accounts of its own, deletes one,
// checks the wreckage, and removes the other in a finally block. It never touches a row it did
// not create, so it is safe to run against the real database.
//
// Runs with --conditions=react-server: lib/account.ts is marked server-only and would
// otherwise throw the moment it is imported outside Next.

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

const leaver = randomUUID();
const stayer = randomUUID();
const groupId = randomUUID();

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, want ${expected})`}`);
}

async function seed() {
    for (const [id, username] of [
        [leaver, `_verify_leaver_${id6()}`],
        [stayer, `_verify_stayer_${id6()}`],
    ] as const) {
        await prisma.users.create({ data: { id } });
        await prisma.profiles.create({ data: { id, username } });
    }

    // A pending wave from the leaver. This is the case that used to abort the whole delete:
    // requested_by/requested_of are ON DELETE SET NULL, and conversations_request_check
    // insists they are null together.
    await prisma.conversations.create({
        data: {
            kind: "dm",
            dm_key: [leaver, stayer].sort().join(":"),
            requested_by: leaver,
            requested_of: stayer,
            members: { create: [{ profile_id: leaver }, { profile_id: stayer }] },
            messages: { create: [{ sender_id: leaver, body: "hi" }] },
        },
    });

    // A group both are in, to prove a group outlives one member leaving.
    await prisma.groups.create({
        data: {
            id: groupId,
            title: "verify group",
            members: { create: [{ profile_id: leaver }, { profile_id: stayer }] },
        },
    });

    await prisma.conversations.create({
        data: {
            kind: "group",
            title: "verify group",
            group_id: groupId,
            members: { create: [{ profile_id: leaver }, { profile_id: stayer }] },
            messages: {
                create: [
                    { sender_id: leaver, body: "from the leaver" },
                    { sender_id: stayer, body: "from the stayer" },
                ],
            },
        },
    });
}

async function main() {
    console.log("Seeding two throwaway accounts, a pending wave and a shared group...");
    await seed();

    console.log(`\nDeleting ${leaver}\n`);
    await deleteAccount(leaver);

    check("auth.users row gone", await prisma.users.count({ where: { id: leaver } }), 0);
    check("profile gone", await prisma.profiles.count({ where: { id: leaver } }), 0);
    check(
        "their messages gone",
        await prisma.messages.count({ where: { sender_id: leaver } }),
        0,
    );
    check(
        "their memberships gone",
        await prisma.conversation_members.count({ where: { profile_id: leaver } }),
        0,
    );
    check(
        "their group membership gone",
        await prisma.group_members.count({ where: { profile_id: leaver } }),
        0,
    );
    check(
        "the DM is gone entirely",
        await prisma.conversations.count({ where: { dm_key: [leaver, stayer].sort().join(":") } }),
        0,
    );

    check("the other person survives", await prisma.profiles.count({ where: { id: stayer } }), 1);
    check(
        "the group conversation survives",
        await prisma.conversations.count({ where: { group_id: groupId } }),
        1,
    );
    check(
        "the other person's group message survives",
        await prisma.messages.count({ where: { sender_id: stayer } }),
        1,
    );

    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
    if (failures > 0) process.exitCode = 1;
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        // Runs even when an assertion above threw, so a failed run does not leave test accounts
        // behind. deleteMany rather than delete: on a run that failed early these may not exist.
        await prisma.groups.deleteMany({ where: { id: groupId } });
        await prisma.users.deleteMany({ where: { id: { in: [leaver, stayer] } } });
        await prisma.$disconnect();
    });

/// Usernames are unique, and a failed run that skipped cleanup would otherwise collide with
/// the next one.
function id6() {
    return randomUUID().slice(0, 6);
}
