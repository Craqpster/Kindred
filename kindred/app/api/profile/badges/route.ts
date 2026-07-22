import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { streamServerClient } from "@/lib/stream";
import { tierForPoints } from "@/lib/confidence-tiers";
import { hasStartedAGame, hasWonAGame } from "@/lib/games";

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

export async function GET(req: Request) {
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

    // Time-based badges
    try {
      const now = new Date();
      const hour = now.getHours();
      const earlyId = findBadge("Early Bird");
      const nightId = findBadge("Night Owl");
      if (earlyId && hour < 9 && !unlockedSet.has(earlyId)) toUnlock.push(earlyId);
      if (nightId && hour < 3 && !unlockedSet.has(nightId)) toUnlock.push(nightId);
    } catch (e) {
      console.warn("Time-based badge check failed", e);
    }

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
    } catch (e) {
      console.warn("Game checks failed", e);
    }

    // Stream-based checks (group messages, channels visited, emoji messages, chats started)
    try {
      const channels = await streamServerClient.queryChannels({ members: { $in: [userId] } }, { last_message_at: -1 }, { state: true, limit: 1000 });

      // Chat Explorer: visited 5 unique rooms
      try {
        const uniqueRooms = channels.length;
        const explorerId = findBadge("Chat Explorer");
        if (explorerId && uniqueRooms >= 5 && !unlockedSet.has(explorerId)) toUnlock.push(explorerId);
      } catch (e) {
        console.warn("Chat explorer check failed", e);
      }

      // Community Helper: sent message in group chat (member_count > 2)
      try {
        const helperId = findBadge("Community Helper");
        if (helperId && !unlockedSet.has(helperId)) {
          let sentInGroup = false;
          for (const ch of channels) {
            const memberCount = (ch.data?.member_count) || (ch.state?.members ? Object.keys(ch.state.members).length : null);
            if (memberCount && memberCount > 2) {
              const msgs = (ch.state && (ch.state.messages as any[])) || [];
              if (msgs.some((m) => m.user && m.user.id === userId)) { sentInGroup = true; break; }
              if (ch.state?.last_message && ch.state.last_message.user_id === userId) { sentInGroup = true; break; }
            }
          }
          if (sentInGroup) toUnlock.push(helperId);
        }
      } catch (e) {
        console.warn("Community helper check failed", e);
      }

      // Conversation Starter: number of channels created_by this user (approx)
      try {
        const starterId = findBadge("Conversation Starter");
        if (starterId && !unlockedSet.has(starterId)) {
          let started = 0;
          for (const ch of channels) {
            const createdBy = ch.data?.created_by_id || ch.state?.created_by?.id || ch.data?.created_by;
            if (createdBy === userId) started += 1;
          }
          if (started >= 10) toUnlock.push(starterId);
        }
      } catch (e) {
        console.warn("Conversation starter check failed", e);
      }

      // Emoji Master: approx count messages containing emoji by this user across channels
      try {
        const emojiId = findBadge("Emoji Master");
        if (emojiId && !unlockedSet.has(emojiId)) {
          let emojiCount = 0;
          const emojiOnly = /^\p{Extended_Pictographic}+$|^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s]+$/u;
          for (const ch of channels) {
            const msgs = (ch.state && (ch.state.messages as any[])) || [];
            for (const m of msgs) {
              if (m.user && m.user.id === userId && typeof m.text === 'string') {
                if (emojiOnly.test(m.text.trim())) emojiCount += 1;
                if (emojiCount >= 50) break;
              }
            }
            if (emojiCount >= 50) break;
          }
          if (emojiCount >= 50) toUnlock.push(emojiId);
        }
      } catch (e) {
        console.warn("Emoji master check failed", e);
      }

    } catch (e) {
      console.warn("Stream checks failed", e);
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