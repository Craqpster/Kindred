"use client";

import { Lightbulb } from "lucide-react";
import { useState } from "react";
import {
    AttachmentSelector,
    ContextMenuButton,
    defaultAttachmentSelectorActionSet,
    useChannelStateContext,
    useContextMenuContext,
    type AttachmentSelectorAction,
    type AttachmentSelectorActionProps,
} from "stream-chat-react";

/// The "+" button's menu, with our own actions alongside Stream's.
///
/// This is where chat actions live from now on. The icebreaker used to be a strip of its
/// own above the composer, which does not survive a second feature - the "+" menu already
/// exists for exactly this and was holding nothing but a file picker.
///
/// Stream types AttachmentSelectorAction["type"] as `... | (string & {})` and its internal
/// filter ends in `return true`, so a custom type is passed through untouched and gets no
/// default modal attached. This is a supported extension point, not a workaround.

// Stream sizes its own menu icons through a rule keyed on `.str-chat__icon`, which a
// lucide icon never carries - so without an explicit size ours fell back to lucide's
// default 24 and sat noticeably larger than the file and poll icons beside it. 16px is
// what Stream's menu items actually render at (20px is the composer's "+" trigger, a
// different rule).
//
// Module scope, not inline in the render: ContextMenuButton takes Icon as a component
// type, and a new function identity each pass would remount the icon every render.
function IcebreakerIcon(props: React.ComponentProps<"svg">) {
    return <Lightbulb {...props} width={16} height={16} strokeWidth={1.5} />;
}

function SendIcebreakerButton({}: AttachmentSelectorActionProps) {
    const { channel } = useChannelStateContext();
    // closeMenu comes from the ContextMenu this button is rendered inside - the same way
    // every built-in action (Poll, Location) dismisses the menu after acting.
    const { closeMenu } = useContextMenuContext();
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (sending) return;
        setSending(true);
        // Close immediately rather than after the request: the menu hanging open while a
        // network call runs reads as the click not having registered.
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

const icebreakerAction: AttachmentSelectorAction = {
    ActionButton: SendIcebreakerButton,
    type: "icebreaker",
};

// Spread rather than hand-write: the built-in `selectCommand` action holds a reference to
// CommandsMenu, which the package does not export, so the default set cannot be rebuilt
// from its parts - only extended.
const actionSet = [...defaultAttachmentSelectorActionSet, icebreakerAction];

/// ComponentContext.AttachmentSelector is typed `React.ComponentType` - no props - and
/// MessageComposerUI renders it with none, so binding the action set needs a wrapper like
/// this. Everything else (filtering, dialogs, modal portals, focus restoration) is still
/// Stream's own component doing the work.
export default function AttachmentMenu() {
    return <AttachmentSelector attachmentSelectorActionSet={actionSet} />;
}
