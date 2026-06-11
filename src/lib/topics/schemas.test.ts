import { describe, it, expect } from "vitest";
import { TopicCandidate, TopicBoardReport } from "@/lib/schemas";

const okSource = { url: "https://x.com/a/status/1", title: "launch post", published_at: "2026-06-11T08:00:00Z" };
const okTopic = { topic: "Claude Code workflows", why_now: "v5 shipped yesterday", angle: "my migration story", kind: "spike", sources: [okSource] };

describe("TopicCandidate", () => {
  it("accepts a sourced topic", () => {
    expect(TopicCandidate.parse(okTopic).sources).toHaveLength(1);
  });
  it("rejects sourceless topics (zero sources)", () => {
    expect(TopicCandidate.safeParse({ ...okTopic, sources: [] }).success).toBe(false);
  });
  it("rejects sources missing published_at", () => {
    const bad = { ...okTopic, sources: [{ url: okSource.url, title: "t" }] };
    expect(TopicCandidate.safeParse(bad).success).toBe(false);
  });
  it("rejects unknown kind", () => {
    expect(TopicCandidate.safeParse({ ...okTopic, kind: "viral" }).success).toBe(false);
  });
});

describe("TopicBoardReport", () => {
  it("requires 1-6 topics", () => {
    expect(TopicBoardReport.safeParse({ topics: [], generatedAt: "x" }).success).toBe(false);
    expect(TopicBoardReport.parse({ topics: [okTopic], generatedAt: "June 11, 2026" }).topics).toHaveLength(1);
  });
});
