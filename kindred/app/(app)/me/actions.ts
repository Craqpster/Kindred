"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { deleteAccount } from "@/lib/account";
import { verifySession } from "@/lib/dal";
import { createClient } from "@/utils/supabase/server";

export type DeleteAccountState = { error?: string };

/// Deletes the signed-in account, permanently.
///
/// The id comes from the session and never from the payload. This action is reachable by a
/// direct POST like any other, and an id in a form body would make it a way to delete other
/// people.
export async function deleteMyAccount(
    _prev: DeleteAccountState,
    formData: FormData,
): Promise<DeleteAccountState> {
    const { userId, email } = await verifySession();

    const parsed = z.string().min(1).safeParse(formData.get("password"));
    if (!parsed.success) return { error: "Enter your password to confirm." };

    // A session only proves this browser was logged in at some point, which a borrowed or
    // unattended laptop also proves. The password is what shows the person clicking is the
    // account holder, and it is worth asking for exactly once, here, for the one action
    // nothing can undo.
    //
    // Note for when Google sign-in lands: an OAuth-only account has no password to re-enter,
    // so this check would lock those users out of deleting themselves. They will need a
    // second route, most likely typing their username to confirm.
    if (!email) return { error: "This account has no password to confirm with." };

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error: wrongPassword } = await supabase.auth.signInWithPassword({
        email,
        password: parsed.data,
    });

    if (wrongPassword) return { error: "That password is not right." };

    await deleteAccount(userId);

    // Local scope on purpose: the cascade already took this session's row with it, so asking
    // the server to revoke it would be a call that can only fail. All that is left to do is
    // drop the cookie.
    await supabase.auth.signOut({ scope: "local" });

    revalidatePath("/", "layout");
    redirect("/");
}
