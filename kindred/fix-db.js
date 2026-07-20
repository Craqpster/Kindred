const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Adding new columns to the profiles table...");
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS badges text[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS display_name_mode text DEFAULT 'username',
      ADD COLUMN IF NOT EXISTS dms_open boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_confidence boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_interests boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS confidence_points integer DEFAULT 0;
    `);

    console.log("Successfully updated the database schema!");
  } catch (error) {
    console.error("Error updating schema:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
