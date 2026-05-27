import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn()
    .mockResolvedValueOnce({ data: { angles: [{ mode: "news-insight", hook: "rollups", source: "https://x" }] } })
    .mockResolvedValueOnce({ data: { posts: ["rollups are underrated"], suggestedVisual: "diagram" } }),
}));

import { proposeAnglesForPillars, draftFromAngle } from "@/server/original";

describe("original post engine", () => {
  it("proposeAnglesForPillars returns researched angles", async () => {
    const angles = await proposeAnglesForPillars(["AI", "agents"]);
    expect(angles[0].mode).toBe("news-insight");
    expect(angles[0].hook).toBe("rollups");
  });
  it("draftFromAngle returns a thread of posts", async () => {
    const d = await draftFromAngle("@cisco voice", { mode: "news-insight", hook: "rollups" });
    expect(d.posts[0]).toContain("rollups");
  });
});
