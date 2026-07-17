"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";

/// Shape returned to useActionState. `values` repopulates the form after a failure —
/// deliberately never the password.
export type AuthState = {
    formError?: string;
    errors?: {
        email?: string[];
        password?: string[];
    };
    values?: {
        email?: string;
    };
};

// Server Functions are reachable by a direct POST, not only through our own form, so
// every action validates its own input rather than trusting the client.
//
// Keep the minimum at or above the Supabase project's password policy (default 6) —
// otherwise zod accepts a password that Supabase then rejects, and the user sees a
// vague form error instead of a field error.
const credentials = z.object({
    email: z.email("Enter a valid email address."),
    password: z.string().min(8, "Use at least 8 characters."),
});

function parse(formData: FormData) {
    return credentials.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
    });
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
    const parsed = parse(formData);
    if (!parsed.success) {
        // zod v4: .flatten() is deprecated, and the bundled Next docs still teach it.
        return {
            errors: z.flattenError(parsed.error).fieldErrors,
            values: { email: String(formData.get("email") ?? "") },
        };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase.auth.signUp(parsed.data);

    if (error) {
        return { formError: error.message, values: { email: parsed.data.email } };
    }

    // Email confirmation is off, so signUp returns a live session. If it is ever turned
    // back on, data.session is null and the user would otherwise be bounced silently to
    // /login by the onboarding gate. Say so instead.
    if (!data.session) {
        return {
            formError: "Check your email to confirm your account, then log in.",
            values: { email: parsed.data.email },
        };
    }

    revalidatePath("/", "layout");
    redirect("/onboarding");
}

export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
    const parsed = parse(formData);
    if (!parsed.success) {
        return {
            errors: z.flattenError(parsed.error).fieldErrors,
            values: { email: String(formData.get("email") ?? "") },
        };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
        // Deliberately generic. Supabase distinguishes "user not found" from "wrong
        // password", which would let anyone probe for registered addresses.
        return { formError: "Invalid email or password.", values: { email: parsed.data.email } };
    }

    revalidatePath("/", "layout");
    // Onboarded users get bounced on to /profile by the onboarding page itself, so this
    // does not need to look up the profile.
    redirect("/onboarding");
}

export async function signOut() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    await supabase.auth.signOut();

    revalidatePath("/", "layout");
    redirect("/");
}
