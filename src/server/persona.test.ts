import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn().mockResolvedValue({
    data: { voiceSpec: "lowercase, punchy", contentPillars: ["AI", "agents"], seedAccounts: ["@balajis"], samplePosts: ["gm"] },
  }),
}));

import { synthesizePersona } from "@/server/persona";

describe("synthesizePersona", () => {
  it("returns the synthesized persona from the model", async () => {
    const p = await synthesizePersona({ niche: "AI", goals: "grow tech twitter", tone: "punchy" });
    expect(p.voiceSpec).toContain("punchy");
    expect(p.contentPillars).toContain("agents");
    expect(p.seedAccounts).toEqual(["@balajis"]);
  });
});
