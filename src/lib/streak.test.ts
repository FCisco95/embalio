import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/streak";
const day = (d: string) => new Date(`${d}T12:00:00Z`);
describe("computeStreak", () => {
  it("returns 0 with no posts", () => expect(computeStreak([], day("2026-06-08"))).toBe(0));
  it("counts a post today as 1", () => expect(computeStreak(["2026-06-08T09:00:00Z"], day("2026-06-08"))).toBe(1));
  it("counts consecutive days ending today", () =>
    expect(computeStreak(["2026-06-08T09:00:00Z","2026-06-07T22:00:00Z","2026-06-06T01:00:00Z"], day("2026-06-08"))).toBe(3));
  it("allows yesterday-only and still counts", () =>
    expect(computeStreak(["2026-06-07T09:00:00Z","2026-06-06T09:00:00Z"], day("2026-06-08"))).toBe(2));
  it("breaks when the latest post is older than yesterday", () =>
    expect(computeStreak(["2026-06-05T09:00:00Z"], day("2026-06-08"))).toBe(0));
  it("dedupes multiple posts on the same day", () =>
    expect(computeStreak(["2026-06-08T09:00:00Z","2026-06-08T18:00:00Z"], day("2026-06-08"))).toBe(1));
});
