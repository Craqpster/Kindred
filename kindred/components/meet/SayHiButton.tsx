import { Hand } from "lucide-react";

import { sayHi } from "@/app/(app)/meet/actions";
import Button from "@/components/ui/Button";

// The only action on a match. Every surface that offers it goes through here, so the
// sayHi import — and the hidden other_id the action validates — live in one place.
//
// There is deliberately no counterpart for skipping someone. Meet has no reject.
export default function SayHiButton({
    id,
    full = false,
}: {
    id: string;
    /// Labelled and full-width, for the spotlight card. Otherwise icon-only, which is
    /// all a compact card has room for.
    full?: boolean;
}) {
    return (
        <form action={sayHi} className={full ? "w-full" : undefined}>
            <input type="hidden" name="other_id" value={id} />

            {full ? (
                <Button type="submit" className="w-full gap-2 bg-accent hover:bg-accent/90">
                    <Hand size={18} aria-hidden />
                    Say hi
                </Button>
            ) : (
                // Icon-only, so it needs an explicit accessible name.
                <Button
                    type="submit"
                    size="icon"
                    aria-label="Say hi"
                    title="Say hi"
                    className="bg-accent hover:bg-accent/90"
                >
                    <Hand size={18} aria-hidden />
                </Button>
            )}
        </form>
    );
}