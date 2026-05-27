import { describe, it, expect } from "vitest";
import { DraftOutput, PersonaSynthesis, AngleList, OriginalDraft } from "@/lib/schemas";

describe("DraftOutput", () => {
  it("accepts a valid draft", () => {
    const r = DraftOutput.safeParse({ body: "gm builders", suggestedVisual: "screenshot of the dashboard" });
    expect(r.success).toBe(true);
  });
  it("allows suggestedVisual to be omitted", () => {
    const r = DraftOutput.safeParse({ body: "hello" });
    expect(r.success).toBe(true);
  });
  it("rejects an empty body", () => {
    const r = DraftOutput.safeParse({ body: "" });
    expect(r.success).toBe(false);
  });
  it("rejects a body over 280 chars", () => {
    const r = DraftOutput.safeParse({ body: "x".repeat(281) });
    expect(r.success).toBe(false);
  });
});

describe("PersonaSynthesis", () => {
  it("accepts a synthesized persona", () => {
    const r = PersonaSynthesis.safeParse({ voiceSpec: "lowercase, punchy", contentPillars: ["AI"], seedAccounts: ["@a"], samplePosts: ["gm"] });
    expect(r.success).toBe(true);
  });
});
describe("AngleList", () => {
  it("requires at least one angle with a valid mode", () => {
    const ok = AngleList.safeParse({ angles: [{ mode: "news-insight", hook: "x" }] });
    expect(ok.success).toBe(true);
    const bad = AngleList.safeParse({ angles: [{ mode: "nope", hook: "x" }] });
    expect(bad.success).toBe(false);
  });
});
describe("OriginalDraft", () => {
  it("accepts a single post and a short thread", () => {
    expect(OriginalDraft.safeParse({ posts: ["one"] }).success).toBe(true);
    expect(OriginalDraft.safeParse({ posts: ["a", "b", "c"], suggestedVisual: "chart" }).success).toBe(true);
  });
  it("rejects an empty thread and an over-long post", () => {
    expect(OriginalDraft.safeParse({ posts: [] }).success).toBe(false);
    expect(OriginalDraft.safeParse({ posts: ["x".repeat(281)] }).success).toBe(false);
  });
});

import { WeeklyAngle, WeeklyAngleList, WeeklyPost, WeeklyPostPlan, ReplyCandidate, ReplyCandidateList, ReplyDraft, ReplyOpportunity, ReplyQueue } from "@/lib/schemas";

describe("WeeklyAngle", () => {
  it("accepts all valid formats", () => {
    for (const format of ["quick-take", "experiment", "tool-find", "observation", "reaction"] as const) {
      expect(WeeklyAngle.safeParse({ format, hook: "test hook", connection: "why" }).success).toBe(true);
    }
  });
  it("rejects unknown format", () => {
    expect(WeeklyAngle.safeParse({ format: "newsletter", hook: "x", connection: "y" }).success).toBe(false);
  });
  it("allows source and sourceDate to be omitted", () => {
    expect(WeeklyAngle.safeParse({ format: "quick-take", hook: "x", connection: "y" }).success).toBe(true);
  });
});

describe("WeeklyAngleList", () => {
  it("accepts 1-5 angles", () => {
    const angle = { format: "quick-take", hook: "x", connection: "y" };
    expect(WeeklyAngleList.safeParse({ angles: [angle] }).success).toBe(true);
    expect(WeeklyAngleList.safeParse({ angles: [angle, angle, angle, angle, angle] }).success).toBe(true);
  });
  it("rejects empty array", () => {
    expect(WeeklyAngleList.safeParse({ angles: [] }).success).toBe(false);
  });
  it("rejects more than 5 angles", () => {
    const angle = { format: "quick-take", hook: "x", connection: "y" };
    expect(WeeklyAngleList.safeParse({ angles: Array(6).fill(angle) }).success).toBe(false);
  });
});

describe("WeeklyPost", () => {
  it("accepts a valid weekly post", () => {
    expect(WeeklyPost.safeParse({
      format: "experiment",
      hook: "tried X",
      posts: ["ran it, broke it"],
      context: "relevant because",
    }).success).toBe(true);
  });
  it("requires at least one post string", () => {
    expect(WeeklyPost.safeParse({ format: "quick-take", hook: "x", posts: [], context: "y" }).success).toBe(false);
  });
  it("allows source, sourceDate, suggestedVisual to be omitted", () => {
    expect(WeeklyPost.safeParse({ format: "quick-take", hook: "x", posts: ["short take"], context: "y" }).success).toBe(true);
  });
});

describe("WeeklyPostPlan", () => {
  it("accepts a plan with posts", () => {
    const post = { format: "quick-take", hook: "x", posts: ["take"], context: "y" };
    expect(WeeklyPostPlan.safeParse({ weekOf: "May 27, 2026", posts: [post] }).success).toBe(true);
  });
});

describe("ReplyCandidate", () => {
  it("accepts a valid candidate with defaults", () => {
    expect(ReplyCandidate.safeParse({ targetHandle: "@kaito", targetPost: "Why MacBook?", reason: "technical" }).success).toBe(true);
  });
});

describe("ReplyDraft", () => {
  it("accepts a reply", () => {
    expect(ReplyDraft.safeParse({ reply: "Apple integrates CPU and GPU on same die.", skip: false }).success).toBe(true);
  });
  it("accepts a skip signal", () => {
    const r = ReplyDraft.safeParse({ skip: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reply).toBeUndefined();
  });
});

describe("ReplyOpportunity", () => {
  it("requires a reply string", () => {
    expect(ReplyOpportunity.safeParse({ targetHandle: "@k", targetPost: "post", reason: "r", reply: "fact." }).success).toBe(true);
    expect(ReplyOpportunity.safeParse({ targetHandle: "@k", targetPost: "post", reason: "r" }).success).toBe(false);
  });
});

describe("ReplyQueue", () => {
  it("accepts an empty opportunities array", () => {
    expect(ReplyQueue.safeParse({ generatedAt: "May 27, 2026", opportunities: [] }).success).toBe(true);
  });
});
