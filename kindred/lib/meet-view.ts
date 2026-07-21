import { z } from "zod";

export const MEET_VIEW_COOKIE = "meet_view";

export const meetViewSchema = z.enum(["spotlight", "grid"]);

export type MeetView = z.infer<typeof meetViewSchema>;

/// The layout to render for a cookie value. Anything unrecognised — absent, stale, or
/// hand-edited — falls back to the spotlight, which is the default experience.
export function meetViewFrom(value: string | undefined): MeetView {
    return value === "grid" ? "grid" : "spotlight";
}