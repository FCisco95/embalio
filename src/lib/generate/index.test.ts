import { describe, it, expect, vi } from "vitest";
import { generateText } from "@/lib/generate";

describe("generateText (subscription backend)", () => {
  it("pipes the prompt to the claude runner and returns trimmed stdout", async () => {
    const runner = vi.fn().mockResolvedValue("  hello world  \n");
    const out = await generateText("say hi", { backend: "subscription" }, runner);
    expect(out).toBe("hello world");
    expect(runner).toHaveBeenCalledWith(["-p"], "say hi");
  });
  it("passes research flags through", async () => {
    const runner = vi.fn().mockResolvedValue("ok");
    await generateText("research X", { backend: "subscription", research: true }, runner);
    expect(runner).toHaveBeenCalledWith(["-p", "--allowedTools", "WebSearch", "WebFetch"], "research X");
  });
});
