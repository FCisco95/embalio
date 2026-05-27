import { describe, it, expect } from "vitest";
import { buildVoiceSystem, buildReplyPrompt, buildOriginalPrompt, buildVoiceSystemFromSpec, buildSynthesisPrompt, buildAnglesPrompt, buildOriginalFromAnglePrompt } from "@/lib/voice-prompt";

const profile = {
  handle: "@cisco",
  niche_description: "crypto/dev/AI builder",
  voice_corpus: ["gm builders", "shipping > talking"],
  voice_notes: "lowercase, no emojis",
};

describe("voice prompt builder", () => {
  it("embeds corpus + notes in a cacheable system block", () => {
    const sys = buildVoiceSystem(profile);
    expect(sys).toContain("gm builders");
    expect(sys).toContain("lowercase, no emojis");
    expect(sys).toContain("crypto/dev/AI builder");
  });
  it("reply prompt includes the target tweet", () => {
    const p = buildReplyPrompt("interesting take on rollups");
    expect(p).toContain("interesting take on rollups");
  });
  it("original prompt includes the topic", () => {
    const p = buildOriginalPrompt("why the X API crackdown matters");
    expect(p).toContain("why the X API crackdown matters");
  });
});

describe("voice spec system", () => {
  it("embeds the voice spec and handle", () => {
    const s = buildVoiceSystemFromSpec({ handle: "@cisco", voice_spec: "lowercase, no emojis" });
    expect(s).toContain("@cisco");
    expect(s).toContain("lowercase, no emojis");
  });
});
describe("synthesis + angle + original prompts", () => {
  it("synthesis prompt includes the answers", () => {
    expect(buildSynthesisPrompt({ niche: "AI", goals: "grow", tone: "punchy" })).toContain("punchy");
  });
  it("angles prompt includes the pillars", () => {
    expect(buildAnglesPrompt(["AI", "agents"])).toContain("agents");
  });
  it("original-from-angle prompt includes the hook", () => {
    expect(buildOriginalFromAnglePrompt("@cisco voice", { mode: "news-insight", hook: "rollups" })).toContain("rollups");
  });
});

import {
  buildCiscoContextBlock,
  buildWorldResearchPrompt,
  buildCrossRefSynthesisPrompt,
  buildWeeklyDraftPrompt,
  buildAlgorithmRulesBlock,
  buildSeedScanPrompt,
  buildReplyFilterPrompt,
  buildReplyDraftPrompt,
} from "@/lib/voice-prompt";

describe("buildCiscoContextBlock", () => {
  it("includes handle, voice spec, pillars, and handoff text", () => {
    const block = buildCiscoContextBlock(
      { handle: "@cisco", voice_spec: "lowercase, no hype", content_pillars: ["AI", "agents"] },
      "## What was built\n\nSpine 1"
    );
    expect(block).toContain("@cisco");
    expect(block).toContain("lowercase, no hype");
    expect(block).toContain("AI");
    expect(block).toContain("Spine 1");
  });

  it("includes journal entry when provided", () => {
    const block = buildCiscoContextBlock(
      { handle: "@cisco", voice_spec: "spec", content_pillars: [] },
      "handoff text",
      "shipped the handoff reader"
    );
    expect(block).toContain("shipped the handoff reader");
  });

  it("omits journal entry section when not provided", () => {
    const block = buildCiscoContextBlock(
      { handle: "@cisco", voice_spec: "spec", content_pillars: [] },
      "handoff text"
    );
    expect(block).not.toContain("working on this week");
  });
});

describe("buildWorldResearchPrompt", () => {
  it("x-topics prompt references the date and 48h window", () => {
    const p = buildWorldResearchPrompt("x-topics", "May 27, 2026");
    expect(p).toContain("May 27, 2026");
    expect(p).toContain("48 hours");
  });
  it("github prompt fetches github.com/trending", () => {
    expect(buildWorldResearchPrompt("github", "May 27, 2026")).toContain("github.com/trending");
  });
  it("news prompt mentions Anthropic and OpenAI", () => {
    expect(buildWorldResearchPrompt("news", "May 27, 2026")).toContain("Anthropic");
  });
});

describe("buildCrossRefSynthesisPrompt", () => {
  it("includes cisco context, all three research threads, and date", () => {
    const p = buildCrossRefSynthesisPrompt(
      "cisco context block",
      { xTopics: "topic A", github: "repo B", news: "news C" },
      "May 27, 2026"
    );
    expect(p).toContain("cisco context block");
    expect(p).toContain("topic A");
    expect(p).toContain("repo B");
    expect(p).toContain("news C");
    expect(p).toContain("May 27, 2026");
  });
  it("includes the WeeklyAngleList JSON shape instruction", () => {
    const p = buildCrossRefSynthesisPrompt("ctx", { xTopics: "", github: "", news: "" }, "today");
    expect(p).toContain("quick-take");
    expect(p).toContain("experiment");
  });
});

describe("buildWeeklyDraftPrompt", () => {
  it("includes voice system and angle hook", () => {
    const p = buildWeeklyDraftPrompt("cisco voice system", { format: "experiment", hook: "ran vitest" }, "");
    expect(p).toContain("cisco voice system");
    expect(p).toContain("ran vitest");
  });
  it("includes format-specific instructions", () => {
    const exp = buildWeeklyDraftPrompt("v", { format: "experiment", hook: "test" }, "");
    expect(exp).toContain("what I tried");
    const qt = buildWeeklyDraftPrompt("v", { format: "quick-take", hook: "test" }, "");
    expect(qt).toContain("200 chars");
  });
  it("appends algorithm rules when provided", () => {
    const p = buildWeeklyDraftPrompt("v", { format: "quick-take", hook: "test" }, "end with a question");
    expect(p).toContain("end with a question");
  });
  it("includes anti-AI-tell rules", () => {
    const p = buildWeeklyDraftPrompt("v", { format: "quick-take", hook: "test" }, "");
    expect(p).toContain("em dashes");
    expect(p).toContain("game-changer");
  });
});

describe("buildAlgorithmRulesBlock", () => {
  it("returns empty string (stub)", () => {
    expect(buildAlgorithmRulesBlock("quick-take")).toBe("");
    expect(buildAlgorithmRulesBlock("experiment")).toBe("");
  });
});

describe("buildSeedScanPrompt", () => {
  it("includes all handles and the date", () => {
    const p = buildSeedScanPrompt(["@karpathy", "@simonw"], "May 27, 2026");
    expect(p).toContain("@karpathy");
    expect(p).toContain("@simonw");
    expect(p).toContain("May 27, 2026");
    expect(p).toContain("24 hours");
  });
});

describe("buildReplyFilterPrompt", () => {
  it("includes cisco context and scanned posts", () => {
    const p = buildReplyFilterPrompt("post A by @kaito", "cisco context");
    expect(p).toContain("post A by @kaito");
    expect(p).toContain("cisco context");
  });
  it("includes the ReplyCandidateList JSON shape", () => {
    expect(buildReplyFilterPrompt("posts", "ctx")).toContain("targetHandle");
  });
});

describe("buildReplyDraftPrompt", () => {
  it("includes the voice system and target post", () => {
    const p = buildReplyDraftPrompt("cisco voice", { targetHandle: "@kaito", targetPost: "Why MacBook?", reason: "technical" });
    expect(p).toContain("cisco voice");
    expect(p).toContain("Why MacBook?");
    expect(p).toContain("@kaito");
  });
  it("includes the no-preamble rule", () => {
    const p = buildReplyDraftPrompt("v", { targetHandle: "@k", targetPost: "post", reason: "r" });
    expect(p).toContain("great question");
  });
  it("includes the skip signal instruction", () => {
    const p = buildReplyDraftPrompt("v", { targetHandle: "@k", targetPost: "post", reason: "r" });
    expect(p).toContain('skip');
  });
});
