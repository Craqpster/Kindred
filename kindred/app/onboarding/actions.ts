"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ageFrom } from "@/lib/age";
import { verifySession } from "@/lib/dal";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type OnboardingState = {
    formError?: string;
    errors?: {
        username?: string[];
        birth_date?: string[];
        tags?: string[];
    };
    /// Which wizard step the error belongs to, so the client can jump back to it
    /// instead of showing a message on a screen the user cannot see.
    /// 3 = handle, 4 = tags, 7 = date of birth.
    errorStep?: 3 | 4 | 7;
};

const MIN_AGE = 18;

const idList = z.array(z.coerce.number().int().positive());

const schema = z.object({
    username: z
        .string()
        .trim()
        .min(3, "At least 3 characters.")
        .max(20, "At most 20 characters.")
        .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only."),
    birth_date: z.coerce
        .date({ error: "Enter your date of birth." })
        .refine((d) => (ageFrom(d) ?? -1) >= MIN_AGE, `You must be ${MIN_AGE} or older.`)
        .refine((d) => (ageFrom(d) ?? 999) <= 120, "Enter a valid date of birth."),
    // Optional at every level: the column is nullable, the step can be skipped, and
    // "Prefer not to say" is itself a real row. Skipping and choosing not to say are
    // different answers, and the schema keeps them different.
    gender_id: z.coerce.number().int().positive().optional(),
    ease_in: z.enum(["openers", "gradual", "volume"]).optional(),
    hobby_ids: idList,
    interest_ids: idList,
});

export async function createProfile(
    _prev: OnboardingState,
    formData: FormData,
): Promise<OnboardingState> {
    const { userId } = await verifySession();

    const parsed = schema.safeParse({
        username: formData.get("username"),
        birth_date: formData.get("birth_date"),
        gender_id: formData.get("gender_id") || undefined,
        ease_in: formData.get("ease_in") || undefined,
        hobby_ids: formData.getAll("hobby_ids"),
        interest_ids: formData.getAll("interest_ids"),
    });

    if (!parsed.success) {
        // zod v4: .flatten() is deprecated and the bundled Next docs still teach it.
        const { username, birth_date } = z.flattenError(parsed.error).fieldErrors;
        return {
            errors: { username, birth_date },
            errorStep: username ? 3 : 7,
        };
    }

    // Checked outside the schema rather than as a .refine(): the chips are one grid
    // drawn from two tables, so neither list can require a selection on its own —
    // picking only Hiking and Cooking is two chips and zero interests, which is valid.
    // The requirement is on the total, and a refinement would have to invent a field
    // name that does not exist on the schema.
    if (parsed.data.hobby_ids.length + parsed.data.interest_ids.length === 0) {
        return { errors: { tags: ["Pick at least one."] }, errorStep: 4 };
    }

    let alreadyOnboarded = false;

    try {
        await prisma.profiles.create({
            data: {
                id: userId,
                username: parsed.data.username,
                birth_date: parsed.data.birth_date,
                gender_id: parsed.data.gender_id ?? null,
                ease_in: parsed.data.ease_in ?? null,
                profile_hobbies: {
                    create: parsed.data.hobby_ids.map((hobby_id) => ({ hobby_id })),
                },
                profile_interests: {
                    create: parsed.data.interest_ids.map((interest_id) => ({ interest_id })),
                },
            },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                // Two different unique indexes can raise this: `username`, or the primary
                // key when a double-submit re-creates a profile this user already has.
                // They need opposite responses, so we have to tell them apart.
                //
                // Not by reading the error: Prisma 7's driver adapters dropped meta.target,
                // and the constraint now hides at meta.driverAdapterError.cause.constraint
                // .fields — undocumented, adapter-specific, and typed as unknown.
                //
                // Ask the database instead. If a row for this user exists, the id is what
                // collided and they are simply already onboarded. If not, the handle is
                // taken. This survives whatever Prisma does to its error shape next.
                const existing = await prisma.profiles.findUnique({
                    where: { id: userId },
                    select: { id: true },
                });

                if (existing) {
                    alreadyOnboarded = true;
                } else {
                    return {
                        errors: { username: ["That handle is taken. Try shuffling."] },
                        errorStep: 3,
                    };
                }
            } else if (error.code === "P2003") {
                // A hobby/interest id with no row behind it. Our grid only ever renders
                // real ids, so this means a hand-crafted POST.
                return { formError: "Some of those selections were invalid.", errorStep: 4 };
            } else {
                throw error;
            }
        } else {
            throw error;
        }
    }

    if (alreadyOnboarded) redirect("/profile");

    revalidatePath("/profile");
    redirect("/chat");
}