// Clears Meet's `connections` rows so people become discoverable again.
//
// Saying hi to someone writes a connections row, and getMatchesFor excludes anyone you have
// one with — permanently, and on purpose: Meet should never offer you somebody you have
// already reached out to. That is right for real use and exhausting for testing, where two
// accounts use each other up on the first wave and can never find each other again.
//
// Conversations and messages are untouched. This only removes the record of who has already
// been greeted, so the same people can appear on /meet once more.
//
// Run:
//   npm run reset:connections                 clears every row
//   npm run reset:connections alex ally       clears only rows between those two, both ways
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

async function main() {
    const usernames = process.argv.slice(2);

    if (usernames.length === 0) {
        const { count } = await prisma.connections.deleteMany({});
        console.log(`Cleared ${count} connection${count === 1 ? "" : "s"}. Everyone is discoverable again.`);
        return;
    }

    const profiles = await prisma.profiles.findMany({
        where: { username: { in: usernames } },
        select: { id: true, username: true },
    });

    const missing = usernames.filter((name) => !profiles.some((p) => p.username === name));
    if (missing.length > 0) {
        throw new Error(`No profile named ${missing.join(", ")}`);
    }

    const ids = profiles.map((profile) => profile.id);

    // Both directions: a wave is one directional row, so clearing only one way would leave
    // the person who waved still unable to see the person who did not.
    const { count } = await prisma.connections.deleteMany({
        where: { user_id: { in: ids }, other_id: { in: ids } },
    });

    console.log(
        `Cleared ${count} connection${count === 1 ? "" : "s"} between ${profiles
            .map((p) => p.username)
            .join(" and ")}.`,
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
