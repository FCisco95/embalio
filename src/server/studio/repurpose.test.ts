import { describe, it, expect } from "vitest";
import { buildVideoThreadPrompt } from "./repurpose-prompt";

describe("buildVideoThreadPrompt", () => {
  it("includes the video title, url, and the beats", () => {
    const p = buildVideoThreadPrompt("VOICE", {
      title: "I shipped a Solana app with Claude",
      url: "https://youtu.be/abc",
      beats: [{ id: "b1", say: "Here is the hook", visualPrompt: "x" }],
    });
    expect(p).toContain("I shipped a Solana app with Claude");
    expect(p).toContain("https://youtu.be/abc");
    expect(p).toContain("Here is the hook");
  });
});
