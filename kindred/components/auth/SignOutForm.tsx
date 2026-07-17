import { signOut } from "@/app/auth/actions";

export default function SignOutForm() {
    return (
        <form action={signOut}>
            <button
                type="submit"
                className="rounded-full border border-star-sapphire px-5 py-2 text-sm font-medium text-star-sapphire transition hover:bg-mist"
            >
                Sign out
            </button>
        </form>
    );
}
