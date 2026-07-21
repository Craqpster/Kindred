// A dedicated Stream user representing the app itself, so icebreaker prompts show up as
// coming from "Kindred" rather than either participant.
//
// Its own module rather than living in lib/prompts.ts, which is `server-only`: the client
// needs this id to tell the bot's messages apart from a person's (ChatConnectionProvider
// filters them out of the toast stack), and importing it from there would drag the Stream
// server client - API secret and all - into the browser bundle.
export const KINDRED_BOT_ID = "kindred-bot";

export const KINDRED_BOT_NAME = "Kindred";
