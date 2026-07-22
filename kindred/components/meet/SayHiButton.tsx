import { Hand } from "lucide-react";

import { sayHi } from "@/app/(app)/meet/actions";
import Button from "@/components/ui/Button";

export default function SayHiButton({
    id,
    labelled = false,
    fullWidth = false,
}: {
    id: string;
    labelled?: boolean;
    fullWidth?: boolean;
}) {
    return (
        <form action={sayHi} className={`shrink-0 ${fullWidth ? "w-full" : ""}`}>
            <input type="hidden" name="other_id" value={id} />

            {labelled ? (
                <Button 
                    type="submit" 
                    variant="primary" 
                    size="md" 
                    className={fullWidth ? "w-full justify-center" : ""}
                >
                    Say hi
                </Button>
            ) : (
                <Button
                    type="submit"
                    variant="primary"
                    size="icon"
                    aria-label="Say hi"
                    title="Say hi"
                    className={fullWidth ? "w-full justify-center" : ""}
                >
                    <Hand size={18} aria-hidden />
                </Button>
            )}
        </form>
    );
}