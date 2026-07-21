"use client";

import { EyeOff } from "lucide-react";
import {
    QuotedMessagePreviewUI,
    useChannelActionContext,
    useChannelStateContext,
    useChatContext,
    useMessageContext,
} from "stream-chat-react";

// Stream's default is 500ms, which for something you have just scrolled to is a flicker
// you can miss entirely - especially when the jump crossed a page and the list was still
// settling. Long enough here to register as "this is the one", short enough not to linger.
const HIGHLIGHT_MS = 1600;

/// Stream's quoted-message rendering, with one exception: an icebreaker answer the viewer
/// has not earned the right to read yet.
///
/// IcebreakerCard keeps other people's answers out of the DOM until you have written your
/// own, but a quote copies the text into someone else's message bubble, which the whole
/// channel sees. Ava quoting Ben's answer would show it to Cara, who has not answered -
/// handing over the exact content the card withholds. Same failure the toast had.
///
/// The check has to be viewer-side. Gating who may quote does nothing, because the person
/// leaked to is a third party whose own answering state is what actually matters.
export default function KindredQuotedMessage() {
    const { message, renderText } = useMessageContext("KindredQuotedMessage");
    const { messages } = useChannelStateContext();
    const { jumpToMessage } = useChannelActionContext("KindredQuotedMessage");
    const { client } = useChatContext();

    const quoted = message.quoted_message;

    if (quoted?.messageType === "prompt_response" && quoted.promptId) {
        const youAnswered = (messages ?? []).some(
            (m) =>
                m.messageType === "prompt_response" &&
                m.promptId === quoted.promptId &&
                m.user?.id === client.userID,
        );

        if (!youAnswered) {
            const promptId = quoted.promptId;

            // Fails closed. If the prompt's answers are outside the loaded page this
            // cannot confirm the viewer answered and withholds anyway - showing withheld
            // content by accident is the worse of the two directions to be wrong in.
            //
            // A button, not a label: it names an action, so it should perform it rather
            // than leave the reader to go hunting for the prompt themselves. Jumping to
            // the prompt is all it takes - IcebreakerCard already claims the highlight
            // and scrolls itself into view when it is the target.
            return (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        jumpToMessage(promptId, undefined, HIGHLIGHT_MS);
                    }}
                    className="my-1 flex cursor-pointer items-center gap-1.5 rounded-xl border border-bone-300 bg-bone-100 px-2.5 py-1.5 text-label text-ink-600 transition-colors hover:border-accent-600 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none"
                >
                    <EyeOff size={12} strokeWidth={1.5} aria-hidden />
                    Answer the icebreaker to see this
                </button>
            );
        }
    }

    if (!quoted) return null;

    // Rendered through Stream's own preview UI rather than its QuotedMessage wrapper, so
    // the click can carry a longer highlight duration. Same stopPropagation/preventDefault
    // the default does - without them the click also selects the surrounding message.
    return (
        <QuotedMessagePreviewUI
            quotedMessage={quoted}
            renderText={renderText}
            onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                jumpToMessage(quoted.id, undefined, HIGHLIGHT_MS);
            }}
        />
    );
}
