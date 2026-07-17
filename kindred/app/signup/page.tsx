import { redirect } from "next/navigation";

import { signUp } from "@/app/auth/actions";
import AuthForm, { AuthFooterLink } from "@/components/auth/AuthForm";
import { getAuthUser } from "@/lib/dal";

export default async function SignUpPage() {
    // Already signed in? Nothing to sign up for. Onboarding decides where to send them.
    if (await getAuthUser()) redirect("/onboarding");

    return (
        <AuthForm
            action={signUp}
            heading="Create your account"
            submitLabel="Sign up"
            passwordHint="At least 8 characters."
            passwordAutoComplete="new-password"
            footer={
                <>
                    Already have an account? <AuthFooterLink href="/login">Log in</AuthFooterLink>
                </>
            }
        />
    );
}
