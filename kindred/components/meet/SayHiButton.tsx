import { Hand } from "lucide-react";

import { sayHi } from "@/app/(app)/meet/actions";
import Button from "@/components/ui/Button";

// The only action on a match. Every surface that offers it goes through here, so the
// sayHi import — and the hidden other_id the action validates — live in one place.
//
// There is deliberately no counterpart for skipping someone. Meet has no reject.
export default function SayHiButton({
    id,
    labelled = false,
}: {
    id: string;
    labelled?: boolean;
}) {
    return (
        <form action={sayHi} className="shrink-0">
            <input type="hidden" name="other_id" value={id} />

            {labelled ? (
                <Button type="submit" variant="accent" size="sm" className="gap-2">
                    <Hand size={16} aria-hidden />
                    Say hi
                </Button>
            ) : (
                // Icon-only, so it needs an explicit accessible name.
                <Button
                    type="submit"
                    variant="accent"
                    size="icon"
                    aria-label="Say hi"
                    title="Say hi"
                >
                    <Hand size={18} aria-hidden />
                </Button>
            )}
        </form>
    );
}