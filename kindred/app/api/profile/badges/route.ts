import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { tierForPoints } from "@/lib/confidence-tiers";
import { hasFinishedAGame, hasStartedAGame, hasWonAGame } from "@/lib/games";
import { hasAnsweredAnIcebreaker } from "@/lib/prompts";

/// Reconciles the caller's badges with the tier their points have actually earned.
///
/// Takes no body. It used to accept `{ newTier }` and write it straight to
/// confidence_level, which meant any signed-in user could PATCH themselves to any tier
/// and unlock every badge. The tier is not the client's to assert - it is a function of
/// confidence_points, which only lib/confidence.ts may move.
///
/// That makes this endpoint a safety net rather than the mechanism: awardConfidenceForMessage
/// already tiers up and grants badges in one transaction. ConfidenceCard calls this when it
/// notices a tier change so a user whose badges somehow lag behind their points can recover
/// without support intervention.
export async function PATCH() {
  try {
    const { userId } = await verifySession();

    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { confidence_points: true, confidence_level: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const earnedTier = tierForPoints(profile.confidence_points ?? 0);

    const eligibleBadges = await prisma.badges.findMany({
      where: { tierRequirement: { lte: earnedTier } },
    });

    // One transaction, matching lib/confidence.ts: a tier must never be recorded without
    // the badges that go with it, or vice versa.
    await prisma.$transaction(async (tx) => {
      for (const badge of eligibleBadges) {
        await tx.profile_badges.upsert({
          where: { profile_id_badge_id: { profile_id: userId, badge_id: badge.id } },
          create: { profile_id: userId, badge_id: badge.id },
          update: {},
        });
      }

      // Only ever forward. Recomputing could otherwise demote someone if the thresholds
      // are retuned upward later, taking badges they had already been shown.
      if (earnedTier > profile.confidence_level) {
        await tx.profiles.update({
          where: { id: userId },
          data: { confidence_level: earnedTier },
        });
      }
    });

    return NextResponse.json({ success: true, tier: earnedTier, unlocked: eligibleBadges.length });
  } catch (error) {
    // verifySession() signals "not signed in" by calling redirect(), which throws rather
    // than returning. Swallowing that here turned an ordinary unauthenticated request
    // into a 500 and hid the redirect Next was trying to perform.
    if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
      if (error.digest.startsWith("NEXT_REDIRECT")) throw error;
    }

    console.error(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId } = await verifySession();

    // Fetch all badges from DB
    const badges = await prisma.badges.findMany();

    // Fetch existing unlocked badges for user
    const existing = await prisma.profile_badges.findMany({ where: { profile_id: userId } });
    const unlockedSet = new Set(existing.map((r) => r.badge_id));

    const toUnlock: string[] = [];

    // Helper to find badge id by name
    const findBadge = (name: string) => badges.find((b) => b.name === name)?.id;

    // Daily Streak: 3 consecutive login days (using sessions table)
    try {
      const sessions = await prisma.sessions.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      const days: string[] = [];
      for (const s of sessions) {
        if (!s.created_at) continue;
        const d = s.created_at.toISOString().slice(0,10);
        if (!days.includes(d)) days.push(d);
      }

      let streak = 0;
      let last = null;
      for (const d of days) {
        const date = new Date(d);
        if (last === null) {
          streak = 1;
        } else {
          const diff = (last.getTime() - date.getTime()) / (1000*60*60*24);
          if (Math.round(diff) === 1) streak += 1; else break;
        }
        last = date;
      }

      const streakId = findBadge("Daily Streak");
      if (streakId && streak >= 3 && !unlockedSet.has(streakId)) toUnlock.push(streakId);
    } catch (e) {
      console.warn("Daily streak check failed", e);
    }

    // Connections / Friend Maker: 3 mutual greeted
    try {
      const made = await prisma.connections.findMany({ where: { user_id: userId } });
      let mutual = 0;
      for (const c of made) {
        const reciprocal = await prisma.connections.findUnique({ where: { user_id_other_id: { user_id: c.other_id, other_id: userId } } });
        if (reciprocal && reciprocal.status === 'greeted' && c.status === 'greeted') mutual += 1;
      }
      const friendId = findBadge("Friend Maker");
      if (friendId && mutual >= 3 && !unlockedSet.has(friendId)) toUnlock.push(friendId);
    } catch (e) {
      console.warn("Friend maker check failed", e);
    }

    // Game Starter / Game Winner: real game_sessions rows, not a guess from chat text.
    // DB-only, unlike the Stream-based checks below - it doesn't need Stream at all.
    try {
      const starterId = findBadge("Game Starter");
      const winnerId = findBadge("Game Winner");

      if (starterId && !unlockedSet.has(starterId) && (await hasStartedAGame(userId))) {
        toUnlock.push(starterId);
      }
      if (winnerId && !unlockedSet.has(winnerId) && (await hasWonAGame(userId))) {
        toUnlock.push(winnerId);
      }

      // Game Finisher is not Game Winner with the winner check dropped - it pays out for
      // reaching the end of a game either way, which is why both exist.
      const finisherId = findBadge("Game Finisher");
      if (finisherId && !unlockedSet.has(finisherId) && (await hasFinishedAGame(userId))) {
        toUnlock.push(finisherId);
      }
    } catch (e) {
      console.warn("Game checks failed", e);
    }

    // The two badges 20260723003000 left without an award path, fixed together because they
    // are the same incident. That migration retargeted Ice Breaker from a tier badge to an
    // activity one by setting tierRequirement = NULL, which drops it out of the tier sweep
    // above (NULL never satisfies `lte`), and moved "answered an icebreaker" onto Open Book,
    // seeded by 20260723004000. Neither replacement check was ever written, so both badges
    // were unreachable: Ice Breaker since the retarget, Open Book since it was created.
    try {
      // Ice Breaker: "Say hi to someone" - the copy BadgesSection.tsx already shows. sayHi
      // writes exactly one connections row per person greeted, so its existence is the check.
      const iceBreakerId = findBadge("Ice Breaker");
      if (iceBreakerId && !unlockedSet.has(iceBreakerId)) {
        const greeted = await prisma.connections.count({ where: { user_id: userId } });
        if (greeted > 0) toUnlock.push(iceBreakerId);
      }

      const openBookId = findBadge("Open Book");
      if (openBookId && !unlockedSet.has(openBookId) && (await hasAnsweredAnIcebreaker(userId))) {
        toUnlock.push(openBookId);
      }
    } catch (e) {
      console.warn("Retargeted badge checks failed", e);
    }

    // Chat-based checks. These used to pull up to 1000 channels out of Stream with their
    // message state attached and loop over them in memory; the counts are now four queries
    // against our own tables, and "Emoji Master" went from approximate (it could only see
    // whatever messages happened to be loaded in channel state) to exact.
    try {
      const [conversationCount, groupMessage, chatsStarted, emojiCount] = await Promise.all([
        // Chat Explorer: been in 5 conversations.
        prisma.conversation_members.count({ where: { profile_id: userId } }),

        // Community Helper: said something in a group, not just a DM.
        prisma.messages.findFirst({
          where: { sender_id: userId, conversation: { kind: "group" } },
          select: { id: true },
        }),

        // Conversation Starter: waves this user sent. requested_by survives being accepted
        // only on conversations still pending, so this counts openers that stayed
        // unanswered - matching the old "channels created by me" reading closely enough,
        // and worth revisiting if the badge should mean "conversations I opened, ever".
        prisma.conversations.count({ where: { requested_by: userId } }),

        // Emoji Master: 50 messages that are nothing but emoji. The regex lives in Postgres
        // rather than in a loop here, so it never loads 50 messages' worth of rows to count
        // them.
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) AS count FROM messages
          WHERE sender_id = ${userId}::uuid
            AND deleted_at IS NULL
            AND btrim(body) ~ '^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\s]+$'
        `,
      ]);

      const explorerId = findBadge("Chat Explorer");
      if (explorerId && conversationCount >= 5 && !unlockedSet.has(explorerId)) {
        toUnlock.push(explorerId);
      }

      const helperId = findBadge("Community Helper");
      if (helperId && groupMessage && !unlockedSet.has(helperId)) toUnlock.push(helperId);

      const starterId = findBadge("Conversation Starter");
      if (starterId && chatsStarted >= 10 && !unlockedSet.has(starterId)) {
        toUnlock.push(starterId);
      }

      const emojiId = findBadge("Emoji Master");
      if (emojiId && Number(emojiCount[0]?.count ?? 0) >= 50 && !unlockedSet.has(emojiId)) {
        toUnlock.push(emojiId);
      }
    } catch (e) {
      // Badges are decoration: a failed check should leave the profile page alone rather
      // than take it down. Same posture the Stream version had.
      console.warn("Chat badge checks failed", e);
    }

    // Insert unlocks into profile_badges
    for (const badgeId of toUnlock) {
      try {
        await prisma.profile_badges.upsert({
          where: { profile_id_badge_id: { profile_id: userId, badge_id: badgeId } },
          create: { profile_id: userId, badge_id: badgeId },
          update: {},
        });
        unlockedSet.add(badgeId);
      } catch (e) {
        console.warn("Failed to upsert badge", badgeId, e);
      }
    }

    // Return badges with unlocked flag and badge fields
    const result = badges.map((b) => ({ ...b, unlocked: unlockedSet.has(b.id) }));
    return NextResponse.json({ badges: result });
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}