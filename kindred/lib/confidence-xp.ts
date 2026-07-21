/// What a qualifying message is worth. An icebreaker answer pays more because it is the
/// harder thing to do - it asks someone to volunteer something about themselves to a
/// stranger, which is exactly the behaviour the confidence ladder exists to encourage.
///
/// Split out of lib/confidence.ts, which is `server-only`: the level popover tells the
/// user how XP is earned, and those numbers have to be the ones actually being awarded
/// rather than a copy in the markup that quietly drifts. Importing them from confidence.ts
/// would drag Prisma and the Stream server client into the browser bundle.
export const XP_PER_MESSAGE = 1;
export const XP_PER_PROMPT_ANSWER = 3;
