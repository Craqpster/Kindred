import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./lib/generated/prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log("Creating new tables...");
    
    // Create badges table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.badges (
        id uuid NOT NULL,
        name text NOT NULL,
        description text NOT NULL,
        icon text,
        "tierRequirement" integer,
        CONSTRAINT badges_pkey PRIMARY KEY (id)
      );
    `);

    // Create profile_badges table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.profile_badges (
        profile_id uuid NOT NULL,
        badge_id uuid NOT NULL,
        CONSTRAINT profile_badges_pkey PRIMARY KEY (profile_id, badge_id),
        CONSTRAINT profile_badges_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT profile_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    // Remove text array badges column if it exists
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.profiles DROP COLUMN badges;`);
    } catch(e) {
      // ignore if it doesn't exist
    }

    console.log("Updating Hobbies and Interests...");

    // Insert new hobbies
    const newHobbies = ['Journaling', 'Thrifting', 'Pilates', 'Photography', 'DIY crafts'];
    for (const h of newHobbies) {
      await prisma.$executeRawUnsafe(`INSERT INTO public.hobbies (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, h);
    }
    
    // Delete unwanted hobbies
    const dropHobbies = ['Weightlifting', 'Makeup artistry'];
    for (const h of dropHobbies) {
      await prisma.$executeRawUnsafe(`DELETE FROM public.hobbies WHERE name = $1`, h);
    }

    // Insert new interests
    const newInterests = ['Indie music', 'Mental wellness', 'Skincare'];
    for (const i of newInterests) {
      await prisma.$executeRawUnsafe(`INSERT INTO public.interests (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, i);
    }

    // Delete unwanted interests
    const dropInterests = ['UX/UI design', 'AI tools', 'Web development'];
    for (const i of dropInterests) {
      await prisma.$executeRawUnsafe(`DELETE FROM public.interests WHERE name = $1`, i);
    }

    console.log("Seeding Badges...");
    const defaultBadges = [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Ice Breaker', description: 'Started your first chat', icon: '🧊', tierReq: 1 },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Social Butterfly', description: 'Reached Tier 2', icon: '🦋', tierReq: 2 },
      { id: '33333333-3333-3333-3333-333333333333', name: 'Kindred Spirit', description: 'Reached Tier 3', icon: '✨', tierReq: 3 },
    ];
    for (const b of defaultBadges) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.badges (id, name, description, icon, "tierRequirement") 
        VALUES ($1::uuid, $2, $3, $4, $5) 
        ON CONFLICT (id) DO NOTHING
      `, b.id, b.name, b.description, b.icon, b.tierReq);
    }

    console.log("Successfully applied updates!");
  } catch (error) {
    console.error("Error updating schema:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
