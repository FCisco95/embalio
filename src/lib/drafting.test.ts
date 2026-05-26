import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { body: "gm builders", suggestedVisual: "dashboard screenshot" },
  }),
}));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: (id: string) => ({ id }) }));

import { generateObject } from "ai";
import { draftReply } from "@/lib/drafting";

const profile = { handle: "@cisco", niche_description: "crypto/dev/AI", voice_corpus: ["gm"], voice_notes: null };

describe("draftReply", () => {
  it("returns a validated DraftOutput and records the model", async () => {
    const d = await draftReply(profile, "rollups are underrated");
    expect(d.body).toBe("gm builders");
    expect(d.model_used).toBe("claude-opus-4-7");
    expect(generateObject).toHaveBeenCalledOnce();
  });
});
