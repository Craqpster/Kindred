import { requestPasswordReset } from "@/app/auth/actions";
import { AuthFooterLink } from "@/components/auth/AuthForm";
import SingleFieldAuthForm from "@/components/auth/SingleFieldAuthForm";

/// Asks for an email and sends a reset link.
///
/// Lives outside the (app) group so it is reachable without a session, which is the whole point.
export default async function ForgotPasswordPage({
    searchParams,
}: {
    searchParams: Promise<{ expired?: string }>;
}) {
    const { expired } = await searchParams;

    return (
        <SingleFieldAuthForm
            action={requestPasswordReset}
            heading={
                expired
                    ? "That link has expired. Send yourself another."
                    : "We'll email you a link to set a new password"
            }
            field={{
                name: "email",
                label: "Email",
                type: "email",
                autoComplete: "email",
            }}
            submitLabel="Send reset link"
            notice="If that address has an account, a reset link is on its way. Check your spam folder if it does not turn up."
            backHref="/login"
            footer={
                <>
                    Remembered it? <AuthFooterLink href="/login">Log in</AuthFooterLink>
                </>
            }
        />
    );
}
