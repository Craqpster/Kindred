import { redirect } from "next/navigation";

import { logIn } from "@/app/auth/actions";
import AuthForm, { AuthFooterLink } from "@/components/auth/AuthForm";
import { getAuthUser } from "@/lib/dal";

export default async function LogInPage() {
    if (await getAuthUser()) redirect("/onboarding");

    return (
        <AuthForm
            action={logIn}
            heading="Welcome back"
            submitLabel="Log in"
            passwordAutoComplete="current-password"
            footer={
                <>
                    New here? <AuthFooterLink href="/signup">Create an account</AuthFooterLink>
                    <br />
                    <AuthFooterLink href="/forgot-password">Forgot your password?</AuthFooterLink>
                </>
            }
        />
    );
}
