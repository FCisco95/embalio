import { describe, it, expect } from "vitest";
import { baitScore } from "@/lib/engagement/bait";

describe("baitScore", () => {
  it("scores a substantive on-topic post near 1", () => {
    const s = baitScore("Spent the morning wiring per-user spend caps into the AI gateway. Hard cap + auto-block when exhausted. Here's the tradeoff I hit.");
    expect(s).toBeGreaterThan(0.8);
  });

  it("demotes choice-bait", () => {
    expect(baitScore("Codex or Claude — which one is your favourite? 👇")).toBeLessThan(0.5);
  });

  it("demotes engagement-farm CTAs", () => {
    expect(baitScore("Drop a 🔥 if you agree. Tag a friend who needs this. RT + follow!")).toBeLessThan(0.4);
  });

  it("demotes giveaway/airdrop bait", () => {
    expect(baitScore("🚨 GIVEAWAY 🚨 Follow + RT + tag 3 friends to win the airdrop!!!")).toBeLessThan(0.3);
  });

  it("clamps to [0,1] and handles empty text", () => {
    expect(baitScore("")).toBeLessThanOrEqual(1);
    expect(baitScore("")).toBeGreaterThanOrEqual(0);
  });
});
