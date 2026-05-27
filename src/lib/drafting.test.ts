import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn().mockResolvedValue({ data: { body: "gm builders", suggestedVisual: "dashboard screenshot" } }),
}));

import { generateStructured } from "@/lib/generate";
import { draftReply } from "@/lib/drafting";

const profile = { handle: "@cisco", niche_description: "crypto/dev/AI", voice_corpus: ["gm"], voice_notes: null, voice_spec: "lowercase" };

describe("draftReply", () => {
  it("returns a validated DraftOutput via the generate wrapper", async () => {
    const d = await draftReply(profile, "rollups are underrated");
    expect(d.body).toBe("gm builders");
    expect(d.model_used).toBe("subscription");
    expect(generateStructured).toHaveBeenCalledOnce();
  });
});
