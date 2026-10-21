import { describe, it, expect } from "vitest";
import { computeConsistency } from "@/lib/gate/consistency";

const NOW = new Date("2026-10-30T15:00:00Z");

describe("computeConsistency", () => {
  it("builds a 30-day UTC window ending today, oldest first, all zero for no posts", () => {
    const r = computeConsistency([], NOW);
    expect(r.days).toBe(30);
    expect(r.target).toBe(21);
    expect(r.publishDays).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.perDay).toHaveLength(30);
    expect(r.perDay[0]).toEqual({ date: "2026-10-01", posts: 0 });
    expect(r.perDay[29]).toEqual({ date: "2026-10-30", posts: 0 });
  });

  it("counts two posts on the same day as one publish day but posts: 2", () => {
    const r = computeConsistency(["2026-10-30T01:00:00Z", "2026-10-30T23:59:59Z"], NOW);
    expect(r.publishDays).toBe(1);
    expect(r.perDay[29]).toEqual({ date: "2026-10-30", posts: 2 });
  });

  it("buckets by UTC day, not local time", () => {
    // 23:30 at -05:00 on the 29th is 04:30 UTC on the 30th.
    const r = computeConsistency(["2026-10-29T23:30:00-05:00"], NOW);
    expect(r.perDay[29].posts).toBe(1);
    expect(r.perDay[28].posts).toBe(0);
  });

  it("ignores posts older than the window, in the future, or unparseable", () => {
    const r = computeConsistency(
      ["2026-09-30T23:59:59Z", "2026-10-31T00:00:00Z", "not-a-date", "2026-10-01T00:00:00Z"],
      NOW,
    );
    expect(r.publishDays).toBe(1);
    expect(r.perDay[0]).toEqual({ date: "2026-10-01", posts: 1 });
  });

  it("passes at exactly 21 distinct days and fails at 20", () => {
    const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00Z`;
    const twenty = Array.from({ length: 20 }, (_, i) => day(i + 1));
    expect(computeConsistency(twenty, NOW).passed).toBe(false);
    expect(computeConsistency([...twenty, day(21)], NOW).passed).toBe(true);
    expect(computeConsistency([...twenty, day(21)], NOW).publishDays).toBe(21);
  });

  it("honours a custom window length", () => {
    const r = computeConsistency(["2026-10-30T10:00:00Z"], NOW, 7);
    expect(r.days).toBe(7);
    expect(r.perDay).toHaveLength(7);
    expect(r.perDay[0].date).toBe("2026-10-24");
  });
});
