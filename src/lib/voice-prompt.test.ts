import { describe, it, expect } from "vitest";
import { buildVoiceSystem, buildReplyPrompt, buildOriginalPrompt } from "@/lib/voice-prompt";

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
