import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/utils/supabase/server";

/// Where an email link lands.
///
/// The link carries proof that the person owns the address; this turns that proof into a
/// session cookie and sends them on. It is a route handler rather than a page because the
/// whole job is a redirect, and nothing here should ever render.
///
/// Two shapes are accepted, because Supabase sends whichever the project's email template
/// asks for. `token_hash` comes from a template using `{{ .TokenHash }}`, which is what
/// Supabase's own SSR guide recommends; `code` comes from the default `{{ .ConfirmationURL }}`
/// template. Handling both means this keeps working whether or not anyone customises the
/// template later, which is exactly the kind of thing that silently breaks a year from now.
///
/// The parameters are consumed here and never reach the browser's history, because the
/// redirect strips them.
export async function GET(request: NextRequest) {
    const { searchParams, origin } = request.nextUrl;

    const tokenHash = searchParams.get("token_hash");
    const code = searchParams.get("code");
    const type = searchParams.get("type");

    // Only ever a path on this site. `next` arrives in a URL, and a URL is user-supplied even
    // when it came from an email we sent — without this, a crafted link could bounce someone
    // to another host carrying a freshly minted session.
    const requested = searchParams.get("next") ?? "/onboarding";
    const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/onboarding";

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
            type: type as "recovery" | "email" | "signup" | "invite" | "email_change",
            token_hash: tokenHash,
        });

        if (!error) return NextResponse.redirect(`${origin}${next}`);
    } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) return NextResponse.redirect(`${origin}${next}`);
    }

    // Expired, already used, or opened in a browser that never asked. The reset page cannot
    // tell those apart either, so they all go back to the start with one honest message.
    return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
}
