"use client";

import {
    CircleDashed,
    Gamepad2,
    Hash,
    Lightbulb,
    ChevronRight,
    ChevronLeft,
} from "lucide-react";
import { createContext, useContext, useState } from "react";
import {
    AttachmentSelector,
    ContextMenuButton,
    defaultAttachmentSelectorActionSet,
    useChannelStateContext,
    useContextMenuContext,
    type AttachmentSelectorAction,
    type AttachmentSelectorActionProps,
} from "stream-chat-react";

// --- State Management ---
type MenuViewState = "root" | "games";
const MenuStateContext = createContext<{
    view: MenuViewState;
    setView: (v: MenuViewState) => void;
} | null>(null);

// --- Icons ---
function IcebreakerIcon(props: React.ComponentProps<"svg">) {
    return <Lightbulb {...props} width={16} height={16} strokeWidth={1.5} />;
}
function GamepadIcon(props: React.ComponentProps<"svg">) {
    return <Gamepad2 {...props} width={16} height={16} strokeWidth={1.5} />;
}
function TicTacToeIcon(props: React.ComponentProps<"svg">) {
    return <Hash {...props} width={16} height={16} strokeWidth={1.5} />;
}
function ConnectFourIcon(props: React.ComponentProps<"svg">) {
    return <CircleDashed {...props} width={16} height={16} strokeWidth={1.5} />;
}
function BackIcon(props: React.ComponentProps<"svg">) {
    return <ChevronLeft {...props} width={16} height={16} strokeWidth={1.5} />;
}

// --- Menu Actions ---

function SendIcebreakerButton({}: AttachmentSelectorActionProps) {
    const { channel } = useChannelStateContext();
    const { closeMenu } = useContextMenuContext();
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (sending) return;
        setSending(true);
        closeMenu();
        try {
            await fetch("/api/chat-prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelCid: channel.cid }),
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <ContextMenuButton Icon={IcebreakerIcon} onClick={send} disabled={sending}>
            Send an icebreaker
        </ContextMenuButton>
    );
}

function GamesMenuButton({}: AttachmentSelectorActionProps) {
    const menuState = useContext(MenuStateContext);
    return (
        <ContextMenuButton
            Icon={GamepadIcon}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                menuState?.setView("games");
            }}
        >
            <div className="flex w-full items-center justify-between gap-4">
                <span>Play a game</span>
                <ChevronRight size={16} className="text-ink-600" />
            </div>
        </ContextMenuButton>
    );
}

function BackButton({}: AttachmentSelectorActionProps) {
    const menuState = useContext(MenuStateContext);
    return (
        <ContextMenuButton
            Icon={BackIcon}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                menuState?.setView("root");
            }}
        >
            Back
        </ContextMenuButton>
    );
}

// 3. The actual game trigger logic
function GameTriggerButton({
    gameType,
    label,
    Icon,
}: {
    gameType: string;
    label: string;
    Icon: React.ComponentType<any>;
}) {
    const { channel } = useChannelStateContext();
    const { closeMenu } = useContextMenuContext();
    const menuState = useContext(MenuStateContext);
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (sending) return;
        setSending(true);
        
        // Close the menu immediately for a snappy UI feel
        closeMenu();
        setTimeout(() => menuState?.setView("root"), 200);

        try {
            // ALWAYS post the open "invite" card directly to the chat!
            // This guarantees the card appears instantly, and you can send as many as you want.
            await channel.sendMessage({
                text: `🎮 Let's play ${label}!`,
                messageType: "game_invite",
                gameType,
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <ContextMenuButton Icon={Icon} onClick={send} disabled={sending}>
            {label}
        </ContextMenuButton>
    );
}

function TicTacToeButton(props: AttachmentSelectorActionProps) {
    return <GameTriggerButton gameType="tic-tac-toe" label="Tic-Tac-Toe" Icon={TicTacToeIcon} />;
}

function ConnectFourButton(props: AttachmentSelectorActionProps) {
    return <GameTriggerButton gameType="connect-four" label="Connect Four" Icon={ConnectFourIcon} />;
}

// --- Action Registries ---
const rootActionSet: AttachmentSelectorAction[] = [
    ...defaultAttachmentSelectorActionSet,
    { ActionButton: SendIcebreakerButton, type: "icebreaker" },
    { ActionButton: GamesMenuButton, type: "games_root" },
];

const gamesActionSet: AttachmentSelectorAction[] = [
    { ActionButton: BackButton, type: "back" },
    { ActionButton: TicTacToeButton, type: "play_tic_tac_toe" },
    { ActionButton: ConnectFourButton, type: "play_connect_four" },
];

// --- Main Wrapper ---
export default function AttachmentMenu() {
    const [view, setView] = useState<MenuViewState>("root");
    const actionSet = view === "games" ? gamesActionSet : rootActionSet;

    return (
        <MenuStateContext.Provider value={{ view, setView }}>
            <AttachmentSelector attachmentSelectorActionSet={actionSet} />
        </MenuStateContext.Provider>
    );
}