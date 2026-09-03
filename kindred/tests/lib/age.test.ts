import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ageFrom } from "../../lib/age";

beforeEach(() => {
  vi.useFakeTimers();
  // Freeze time to a known date so tests are deterministic.
  vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ageFrom", () => {
  it("returns null for null input", () => {
    expect(ageFrom(null)).toBeNull();
  });

  it("computes age when birthday has already occurred this year", () => {
    const birth = new Date("2000-01-01T00:00:00Z");
    expect(ageFrom(birth)).toBe(26);
  });

  it("computes age when birthday has not yet occurred this year", () => {
    const birth = new Date("2000-12-31T00:00:00Z");
    expect(ageFrom(birth)).toBe(25);
  });

  it("handles birthdays on the same day correctly", () => {
    const birth = new Date("2000-09-03T00:00:00Z");
    expect(ageFrom(birth)).toBe(26);
  });
});
