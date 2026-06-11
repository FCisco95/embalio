import { describe, it, expect, vi } from "vitest";
import { topicTerms, computeHeat, heatForTopic } from "./heat";

describe("topicTerms", () => {
  it("keeps significant lowercase tokens, drops stopwords + short words", () => {
    expect(topicTerms("The Claude Code v5 Agent Workflows")).toEqual(["claude", "code", "agent", "workflows"]);
  });
  it("caps at 6 terms and strips non-word chars", () => {
    const terms = topicTerms("alpha-beta gamma, delta epsilon zeta eta theta!");
    expect(terms.length).toBeLessThanOrEqual(6);
    for (const t of terms) expect(t).toMatch(/^[a-z0-9]+$/);
  });
});

describe("computeHeat", () => {
  it("zero activity → zero heat, not declining", () => {
    expect(computeHeat(0, 0)).toEqual({ heat01: 0, recent: 0, prior: 0, velocityRatio: 0, declining: false });
  });
  it("strong acceleration saturates heat", () => {
    const h = computeHeat(20, 2);
    expect(h.heat01).toBe(1);
    expect(h.velocityRatio).toBe(10);
    expect(h.declining).toBe(false);
  });
  it("declining when recent < prior", () => {
    expect(computeHeat(3, 9).declining).toBe(true);
  });
  it("heat01 stays in [0,1]", () => {
    expect(computeHeat(500, 1).heat01).toBeLessThanOrEqual(1);
    expect(computeHeat(1, 0).heat01).toBeGreaterThan(0);
  });
});

describe("heatForTopic", () => {
  it("counts recent (0-24h) vs prior (24-48h) matching signal_tweets", async () => {
    const calls: { gte: string; lt?: string }[] = [];
    let call = 0;
    const mkChain = (count: number) => {
      const chain = {
        gte: vi.fn((_c: string, v: string) => { calls.push({ gte: v }); return chain; }),
        lt: vi.fn((_c: string, v: string) => { calls[calls.length - 1].lt = v; return chain; }),
        or: vi.fn(() => Promise.resolve({ count, error: null })),
      };
      return chain;
    };
    const sb = {
      from: vi.fn(() => ({
        select: vi.fn(() => mkChain(call++ === 0 ? 8 : 2)),
      })),
    };
    const h = await heatForTopic(sb as never, "claude agents");
    expect(h.recent).toBe(8);
    expect(h.prior).toBe(2);
    expect(h.velocityRatio).toBe(4);
    expect(calls).toHaveLength(2);
  });
  it("returns zero heat when topic has no usable terms", async () => {
    const sb = { from: vi.fn() };
    const h = await heatForTopic(sb as never, "the of and");
    expect(h).toEqual(computeHeat(0, 0));
    expect(sb.from).not.toHaveBeenCalled();
  });
});
