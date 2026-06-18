import { describe, it, expect } from "vitest";
import { pearson, replyFollowAttribution, buildReplyFollowPairs, type DailyPair } from "./attribution";

const pairs = (n: number, fn: (i: number) => DailyPair): DailyPair[] => Array.from({ length: n }, (_, i) => fn(i));

describe("attribution", () => {
  it("computes pearson and is 0 for degenerate input", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 5);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it("guards below n=20 with insufficient_data", () => {
    const a = replyFollowAttribution(pairs(19, (i) => ({ replies: i, followerDelta: i })));
    expect(a.status).toBe("insufficient_data");
    if (a.status === "insufficient_data") { expect(a.n).toBe(19); expect(a.minN).toBe(20); }
  });

  it("reports correlation (labeled, with disclaimer) at n≥20", () => {
    const a = replyFollowAttribution(pairs(22, (i) => ({ replies: i, followerDelta: 2 * i })));
    expect(a.status).toBe("correlation");
    if (a.status === "correlation") {
      expect(a.r).toBeCloseTo(1, 5);
      expect(a.label).toBe("correlation");
      expect(a.disclaimer.toLowerCase()).toContain("correlation");
      expect(a.disclaimer.toLowerCase()).not.toContain("causes");
    }
  });

  it("buildReplyFollowPairs dedups multi-source days (latest captured_at wins) then diffs", () => {
    const replies = [{ created_at: "2026-06-16T10:00:00Z" }, { created_at: "2026-06-16T12:00:00Z" }];
    const snaps = [
      { snapshot_date: "2026-06-15", captured_at: "2026-06-15T01:00:00Z", followers: 100 },
      { snapshot_date: "2026-06-16", captured_at: "2026-06-16T01:00:00Z", followers: 110 }, // csv
      { snapshot_date: "2026-06-16", captured_at: "2026-06-16T23:00:00Z", followers: 115 }, // later scrape wins
    ];
    expect(buildReplyFollowPairs(replies, snaps)).toEqual([{ replies: 2, followerDelta: 15 }]);
  });
});
