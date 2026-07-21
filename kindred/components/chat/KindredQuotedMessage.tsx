"use client";

import { EyeOff } from "lucide-react";
import {
    QuotedMessage,
    useChannelStateContext,
    useChatContext,
    useMessageContext,
} from "stream-chat-react";

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
    const { message } = useMessageContext("KindredQuotedMessage");
    const { messages } = useChannelStateContext();
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
            // Fails closed. If the prompt's answers are outside the loaded page this
            // cannot confirm the viewer answered and withholds anyway - showing withheld
            // content by accident is the worse of the two directions to be wrong in.
            return (
                <div className="my-1 flex items-center gap-1.5 rounded-xl border border-bone-300 bg-bone-100 px-2.5 py-1.5 text-label text-ink-600">
                    <EyeOff size={12} strokeWidth={1.5} aria-hidden />
                    Answer the icebreaker to see this
                </div>
            );
        }
    }

    return <QuotedMessage />;
}
