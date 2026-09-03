import { describe, it, expect } from "vitest";
import { getChatLevel, xpToReachNextLevel, XP_PER_LEVEL_STEP } from "../../lib/chat-level";

describe("chat level math", () => {
  it("xpToReachNextLevel returns XP_PER_LEVEL_STEP * level", () => {
    expect(xpToReachNextLevel(1)).toBe(XP_PER_LEVEL_STEP * 1);
    expect(xpToReachNextLevel(5)).toBe(XP_PER_LEVEL_STEP * 5);
  });

  it("level calculations at boundaries", () => {
    // thresholds: level 1 start = 0, level 2 start = 5, level 3 start = 15
    let res = getChatLevel(0);
    expect(res.level).toBe(1);
    expect(res.xpIntoLevel).toBe(0);
    expect(res.xpForNextLevel).toBe(5);

    res = getChatLevel(4);
    expect(res.level).toBe(1);
    expect(res.xpIntoLevel).toBe(4);

    res = getChatLevel(5);
    expect(res.level).toBe(2);
    expect(res.xpIntoLevel).toBe(0);

    res = getChatLevel(14);
    expect(res.level).toBe(2);
    expect(res.xpIntoLevel).toBe(9);

    res = getChatLevel(15);
    expect(res.level).toBe(3);
    expect(res.xpIntoLevel).toBe(0);
  });

  it("handles NaN and Infinity safely", () => {
    expect(getChatLevel(NaN).level).toBe(1);
    expect(getChatLevel(Infinity).level).toBe(1);
  });
});
