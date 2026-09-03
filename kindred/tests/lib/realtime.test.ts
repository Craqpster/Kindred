import { describe, expect, it } from "vitest";

import { backfillCursor } from "../../lib/chat/realtime";
import type { TimelineMessage } from "../../lib/chat/types";

// backfillCursor decides which timestamp a reconnect asks the server to catch it up from.
// Getting it wrong is silent: too new a cursor skips messages that were never delivered in
// the first place, so the hole it was called to fill stays there with nothing to reveal it.

function message(
    createdAt: string,
    status?: TimelineMessage["status"],
): TimelineMessage {
    return {
        id: createdAt,
        conversationId: "c",
        kind: "text",
        body: "hi",
        sender: null,
        replyTo: null,
        promptId: null,
        parentId: null,
        replyCount: 0,
        gameType: null,
        reactions: [],
        createdAt,
        editedAt: null,
        deletedAt: null,
        pinnedAt: null,
        ...(status ? { status } : {}),
    };
}

const EPOCH = new Date(0).toISOString();

describe("backfillCursor", () => {
    it("takes the newest server message", () => {
        expect(
            backfillCursor([
                message("2026-09-03T10:00:00.000Z"),
                message("2026-09-03T12:00:00.000Z"),
                message("2026-09-03T11:00:00.000Z"),
            ]),
        ).toBe("2026-09-03T12:00:00.000Z");
    });

    it("counts a message confirmed sent", () => {
        expect(
            backfillCursor([
                message("2026-09-03T10:00:00.000Z"),
                message("2026-09-03T12:00:00.000Z", "sent"),
            ]),
        ).toBe("2026-09-03T12:00:00.000Z");
    });

    // The case this function exists for. An optimistic message is stamped with the browser's
    // clock, so a machine running fast puts a timestamp in the future at the end of the
    // timeline. Anchoring there would ask the server for messages after a moment that has
    // not happened yet, and everything actually missed would be skipped.
    it("ignores a message still in flight, however new its timestamp", () => {
        expect(
            backfillCursor([
                message("2026-09-03T10:00:00.000Z"),
                message("2099-01-01T00:00:00.000Z", "sending"),
            ]),
        ).toBe("2026-09-03T10:00:00.000Z");
    });

    it("ignores a message whose send failed", () => {
        expect(
            backfillCursor([
                message("2026-09-03T10:00:00.000Z"),
                message("2099-01-01T00:00:00.000Z", "failed"),
            ]),
        ).toBe("2026-09-03T10:00:00.000Z");
    });

    // Not a request for all history: getMessagesSince caps at a page and reports the gap, so
    // an epoch cursor resolves to "the newest page", which is what an empty timeline wants.
    it("falls back to the epoch when the timeline is empty", () => {
        expect(backfillCursor([])).toBe(EPOCH);
    });

    it("falls back to the epoch when nothing has been confirmed yet", () => {
        expect(
            backfillCursor([
                message("2026-09-03T10:00:00.000Z", "sending"),
                message("2026-09-03T11:00:00.000Z", "failed"),
            ]),
        ).toBe(EPOCH);
    });
});
