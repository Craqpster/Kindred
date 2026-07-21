import { signOut } from "@/app/auth/actions";

export default function SignOutForm() {
    return (
        <form action={signOut}>
            <button
                type="submit"
                className="rounded-full border border-bone-300 px-5 py-2 text-meta font-medium text-ink-600 transition hover:bg-bone-200 hover:text-ink-900"
            >
                Sign out
            </button>
        </form>
    );
}
