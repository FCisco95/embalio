import { describe, it, expect } from "vitest";
import { targetScore, type TargetScoreInputs } from "@/lib/sniper/score";

const base: TargetScoreInputs = {
  relevance: 0.8,
  ageMinutes: 20,
  replyCount: 8,
  repliesPerHour: 24,
  authorFollowers: 6_500,
  ownerFollowers: 1_300,   // 5x → in 2-10 band
  bait: 1,
};

describe("targetScore — playbook §4 formula", () => {
  it("scores a fresh, fast, in-band, relevant post high with no drop", () => {
    const r = targetScore(base);
    expect(r.drop).toBeNull();
    expect(r.score).toBeGreaterThan(0.7);
    expect(r.parts.sizeFit).toBe(1);
    expect(r.parts.recency).toBe(1); // inside the 0-60 min gold window
  });

  it("weights relevance highest", () => {
    const high = targetScore(base);
    const low = targetScore({ ...base, relevance: 0.1 });
    expect(high.score - low.score).toBeGreaterThan(0.15); // 0.30 weight × 0.7 delta ≈ 0.21
  });

  it("hard-drops >30 replies (can't land top-5)", () => {
    expect(targetScore({ ...base, replyCount: 31 }).drop).toBe("crowded");
  });

  it("hard-drops >3h old unless still visibly hot", () => {
    expect(targetScore({ ...base, ageMinutes: 200, repliesPerHour: 4 }).drop).toBe("stale");
    expect(targetScore({ ...base, ageMinutes: 200, repliesPerHour: 25, replyCount: 20 }).drop).toBeNull();
  });

  it("hard-drops engagement bait", () => {
    expect(targetScore({ ...base, bait: 0.2 }).drop).toBe("bait");
  });

  it("decays recency linearly after the gold window", () => {
    const at60 = targetScore({ ...base, ageMinutes: 60 }).parts.recency;
    const at120 = targetScore({ ...base, ageMinutes: 120 }).parts.recency;
    expect(at60).toBe(1);
    expect(at120).toBeCloseTo(0.5);
  });

  it("gives followback credit to peers, less to bigger accounts", () => {
    const peer = targetScore({ ...base, authorFollowers: 1_300 }); // 1x
    const big = targetScore({ ...base, authorFollowers: 13_000 }); // 10x
    expect(peer.parts.followback).toBe(1);
    expect(big.parts.followback).toBeCloseTo(0.2);
  });

  it("survives zero/unknown owner followers without NaN", () => {
    const r = targetScore({ ...base, ownerFollowers: 0 });
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.parts.sizeFit).toBe(1); // unknown size = neutral, matches sizeFit convention
  });
});
