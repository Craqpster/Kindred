import { redirect } from "next/navigation";

import { updatePassword } from "@/app/auth/actions";
import { AuthFooterLink } from "@/components/auth/AuthForm";
import SingleFieldAuthForm from "@/components/auth/SingleFieldAuthForm";
import { getAuthUser } from "@/lib/dal";

/// Sets the new password.
///
/// Reached only after /auth/confirm has turned the emailed link into a session, so landing here
/// without one means the link expired, was already used, or was opened in a different browser.
/// Bounced back rather than shown a form that cannot work.
///
/// It is also why there is no token field: the session is the proof, and it is already in a
/// cookie by the time this renders.
export default async function ResetPasswordPage() {
    if (!(await getAuthUser())) redirect("/forgot-password?expired=1");

    return (
        <SingleFieldAuthForm
            action={updatePassword}
            heading="Choose a new password"
            field={{
                name: "password",
                label: "New password",
                type: "password",
                // new-password so a password manager offers to generate and save one instead of
                // autofilling the old one it already has.
                autoComplete: "new-password",
            }}
            hint="At least 8 characters."
            submitLabel="Save password"
            backHref="/login"
            footer={
                <>
                    Changed your mind? <AuthFooterLink href="/login">Log in</AuthFooterLink>
                </>
            }
        />
    );
}
