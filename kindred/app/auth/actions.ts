"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
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

/// Sends the "reset your password" email.
///
/// Always reports success, even for an address with no account. Supabase itself will not say
/// either way, and neither should we: a form that distinguishes them is a way to find out who
/// has signed up, which matters more here than on most apps because the accounts are people
/// looking to talk to strangers.
///
/// The redirect target is built from the request's own origin rather than an env var, so this
/// works on localhost, on a Vercel preview, and in production without configuration. Supabase
/// still has to allow the URL — Authentication, URL Configuration, Redirect URLs.
export async function requestPasswordReset(
    _prev: AuthState,
    formData: FormData,
): Promise<AuthState> {
    const parsed = z.email("Enter a valid email address.").safeParse(formData.get("email"));

    if (!parsed.success) {
        return { errors: { email: ["Enter a valid email address."] } };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const origin = (await headers()).get("origin") ?? "";

    await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${origin}/auth/confirm?next=/reset-password`,
    });

    // Deliberately not checking the error. A rate limit or an unknown address both come back
    // here, and reporting either one tells the sender something about the account.
    return { formError: "If that address has an account, a reset link is on its way." };
}

/// Sets a new password for whoever the current session belongs to.
///
/// Reachable two ways, and it does not care which: with a recovery session minted by the email
/// link, or by somebody already logged in changing their password. Both are the same operation
/// on the same session, which is why there is no token parameter here — the session is the
/// proof, and it was established by /auth/confirm before this page ever rendered.
export async function updatePassword(
    _prev: AuthState,
    formData: FormData,
): Promise<AuthState> {
    const parsed = z
        .string()
        .min(8, "Use at least 8 characters.")
        .safeParse(formData.get("password"));

    if (!parsed.success) {
        return { errors: { password: ["Use at least 8 characters."] } };
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // No session means the link expired, was already used, or was opened in a different
    // browser from the one that requested it. All three land here and all three are fixed the
    // same way, so they get one message.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { formError: "That reset link has expired. Request a new one." };
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data });

    if (error) {
        return { formError: error.message };
    }

    revalidatePath("/", "layout");
    redirect("/onboarding");
}

export async function signOut() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    await supabase.auth.signOut();

    revalidatePath("/", "layout");
    redirect("/");
}
