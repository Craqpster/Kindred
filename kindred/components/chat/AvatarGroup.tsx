import Avatar from "@/components/ui/Avatar";

const MAX_SHOWN = 3;

type GroupMember = {
    name: string;
    avatarId?: string | null;
    avatarSeed?: string | null;
};

export default function AvatarGroup({ 
    users, 
    size = 32 
}: { 
    users?: GroupMember[]; 
    size?: number 
}) {
    const list = users ?? [];
    const shown = list.slice(0, MAX_SHOWN);
    const overflow = list.length - shown.length;

    return (
        <span aria-hidden="true" className="flex shrink-0 items-center">
            {shown.map((user, i) => (
                <Avatar
                    key={i}
                    name={user.name}
                    avatarId={user.avatarId}
                    avatarSeed={user.avatarSeed}
                    size={size}
                    className={`ring-2 ring-surface ${i > 0 ? "-ml-2" : ""}`}
                />
            ))}

            {overflow > 0 && (
                <span
                    style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
                    className="-ml-2 inline-flex shrink-0 items-center justify-center rounded-full bg-bone-200 font-semibold text-star-sapphire ring-2 ring-surface"
                >
                    +{overflow}
                </span>
            )}
        </span>
    );
}