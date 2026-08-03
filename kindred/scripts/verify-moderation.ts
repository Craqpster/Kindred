import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";
import { recordFlaggedAttempt } from "../lib/moderation-rate-limit";


const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
    });


async function main() {

    const target = await prisma.profiles.findFirst({ select: { id: true, username: true } });

    if (!target) throw new Error("No profiles to test with");

    // deleteMany, not delete: delete throws when there is no row, and on a first run there is not one

    await prisma.moderation_state.deleteMany({ where: { profile_id: target.id } });

    console.log(`Flagging ${target.username} six times to test the moderation rate limit escalation...`);

    for (let strike = 1; strike <= 6; strike++) {
        const cooldownUntil = await recordFlaggedAttempt(target.id);
        
        const label = 
            cooldownUntil === null 
                ? "warning, no cooldown" 
                : `cooldown ${Math.round((cooldownUntil - Date.now()) / 1000)}s`;

        console.log(` Strike ${strike}: ${label}`);
    }

    await prisma.moderation_state.deleteMany({ where: { profile_id: target.id } });
    console.log("\nCleaned up.");
}

  
main()
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());