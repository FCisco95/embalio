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
