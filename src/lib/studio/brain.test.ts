import { describe, it, expect, vi } from "vitest";
import { makeLocalClaudeBrain, buildRankPrompt, buildScriptPrompt, buildBriefPrompt, buildPlaybookPrompt } from "./brain";
import type { AlgorithmBrief, ChannelPlaybook, RankedTopic, TrendSignal } from "./schemas";

const playbook: ChannelPlaybook = {
  positioning: "Vibe-coder on blockchain",
  northStar: { devBrand: "1k subs", organic: "ship weekly" },
  pillars: [{ name: "Build logs", why: "trust" }],
  packagingFormulas: ["I built X with Y in Z"],
  retentionRules: ["pay off the hook in 15s"],
  cadence: "2/week",
  nextMoves: ["record the teardown"],
};
const signals: TrendSignal[] = [{ source: "hackernews", id: "1", title: "T", url: "u" }];
const topic: RankedTopic = { id: "t", title: "T", angle: "a", score: 90, rationale: "r", sourceRefs: [] };

describe("LocalClaudeBrain", () => {
  it("rankTopics returns parsed topics and respects count", async () => {
    const gen = vi.fn(async () => ({ data: { topics: [
      { id: "a", title: "A", angle: "x", score: 90, rationale: "r", sourceRefs: [] },
      { id: "b", title: "B", angle: "y", score: 80, rationale: "r", sourceRefs: [] },
    ] } }));
    const brain = makeLocalClaudeBrain(gen as never);
    const out = await brain.rankTopics({ niche: "vibe coding on blockchain", signals: [], count: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a");
  });
  it("writeScript returns a parsed VideoScript", async () => {
    const gen = vi.fn(async () => ({ data: { title: "T", hook: "H", beats: [{ id: "b1", say: "s", visualPrompt: "v" }] } }));
    const brain = makeLocalClaudeBrain(gen as never);
    const topic: RankedTopic = { id: "a", title: "A", angle: "x", score: 90, rationale: "r", sourceRefs: [] };
    const out = await brain.writeScript({ topic });
    expect(out.beats[0].say).toBe("s");
  });
  it("throws a friendly error when generation returns null", async () => {
    const gen = vi.fn(async () => ({ data: null, raw: "junk" }));
    const brain = makeLocalClaudeBrain(gen as never);
    await expect(brain.rankTopics({ niche: "x", signals: [] })).rejects.toThrow(/topic ranking failed/);
  });
  it("prompt builders include the niche and the topic title", () => {
    expect(buildRankPrompt({ niche: "NICHE", signals: [{ source: "hackernews", id: "1", title: "SIG", url: "u" }] })).toContain("NICHE");
    expect(buildRankPrompt({ niche: "NICHE", signals: [{ source: "hackernews", id: "1", title: "SIG", url: "u" }] })).toContain("SIG");
    const topic: RankedTopic = { id: "a", title: "TITLE", angle: "x", score: 1, rationale: "r", sourceRefs: [] };
    expect(buildScriptPrompt({ topic })).toContain("TITLE");
  });
});

describe("buildRankPrompt", () => {
  it("weaves the playbook in when present", () => {
    const p = buildRankPrompt({ niche: "n", signals, playbook });
    expect(p).toContain("Vibe-coder on blockchain");
    expect(p).toContain("I built X with Y in Z");
  });
  it("omits the playbook block cleanly when absent", () => {
    const p = buildRankPrompt({ niche: "n", signals });
    expect(p).not.toContain("Channel playbook");
  });
});

describe("buildScriptPrompt", () => {
  it("applies the playbook's retention rules when present", () => {
    const p = buildScriptPrompt({ topic, playbook });
    expect(p).toContain("pay off the hook in 15s");
  });
  it("omits the playbook block cleanly when absent", () => {
    const p = buildScriptPrompt({ topic });
    expect(p).not.toContain("Channel playbook");
  });
});

const brief: AlgorithmBrief = {
  packaging: ["front-load the payoff"], retention: ["15s hook"], formats: ["build logs"],
  cadence: "2/week", authenticity: ["real face"], summary: "sum", sources: [],
};

describe("buildBriefPrompt", () => {
  it("asks for current, sourced best practices for the niche", () => {
    const p = buildBriefPrompt("vibe-coder on blockchain");
    expect(p).toContain("vibe-coder on blockchain");
    expect(p.toLowerCase()).toContain("source");
  });
});

describe("buildPlaybookPrompt", () => {
  it("includes the niche and the brief's guidance", () => {
    const p = buildPlaybookPrompt({ niche: "vibe-coder", brief });
    expect(p).toContain("vibe-coder");
    expect(p).toContain("front-load the payoff");
  });
});

describe("buildScriptPrompt — follow-along fields", () => {
  const topic = { id: "t1", title: "X", angle: "y", score: 50, rationale: "z", sourceRefs: [] };
  it("asks the model for do/fx/ost/brollKeywords/markerLabel with an example", () => {
    const p = buildScriptPrompt({ topic });
    for (const field of ["do", "fx", "ost", "brollKeywords", "markerLabel"]) {
      expect(p).toContain(field);
    }
    expect(p.toLowerCase()).toContain("example");
  });
});
