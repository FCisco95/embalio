import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { generateText, generateStructured } from "@/lib/generate";
import { RESEARCH_TIMEOUT_MS } from "@/lib/generate/runner";

describe("generateText (subscription backend)", () => {
  it("pipes the prompt to the claude runner and returns trimmed stdout", async () => {
    const runner = vi.fn().mockResolvedValue("  hello world  \n");
    const out = await generateText("say hi", { backend: "subscription" }, runner);
    expect(out).toBe("hello world");
    expect(runner).toHaveBeenCalledWith(["-p"], "say hi");
  });
  it("passes research flags through with a longer timeout", async () => {
    const runner = vi.fn().mockResolvedValue("ok");
    await generateText("research X", { backend: "subscription", research: true }, runner);
    expect(runner).toHaveBeenCalledWith(["-p", "--allowedTools", "WebSearch", "WebFetch"], "research X", RESEARCH_TIMEOUT_MS);
  });
});

describe("generateStructured", () => {
  const S = z.object({ a: z.string() });
  it("returns parsed data on first valid reply", async () => {
    const runner = vi.fn().mockResolvedValue('{"a":"ok"}');
    const r = await generateStructured(S, "make a", { backend: "subscription" }, runner);
    expect("data" in r && r.data && (r.data as { a: string }).a).toBe("ok");
    expect(runner).toHaveBeenCalledTimes(1);
  });
  it("retries once then returns raw on persistent failure", async () => {
    const runner = vi.fn().mockResolvedValue("not json");
    const r = await generateStructured(S, "make a", { backend: "subscription" }, runner);
    expect(r.data).toBeNull();
    expect(runner).toHaveBeenCalledTimes(2);
  });
  it("feeds the validation error into the retry so a schema violation can be fixed", async () => {
    const runner = vi.fn()
      .mockResolvedValueOnce('{"a":123}')      // valid JSON, wrong type
      .mockResolvedValueOnce('{"a":"fixed"}'); // corrected on retry
    const r = await generateStructured(S, "make a", { backend: "subscription" }, runner);
    expect("data" in r && r.data && (r.data as { a: string }).a).toBe("fixed");
    expect(runner).toHaveBeenCalledTimes(2);
    const retryPrompt = runner.mock.calls[1][1] as string;
    expect(retryPrompt).toMatch(/did not satisfy the required shape/);
  });
  it("honors a higher attempts budget for constraint-heavy schemas", async () => {
    // Fails the first 3 attempts, succeeds on the 4th — a multi-item schema
    // (e.g. a thread where any one tweet can blow a length limit) needs more
    // than the default single retry to converge.
    const runner = vi.fn()
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce("still not json")
      .mockResolvedValueOnce('{"a":123}')
      .mockResolvedValueOnce('{"a":"ok"}');
    const r = await generateStructured(S, "make a", { backend: "subscription", attempts: 4 }, runner);
    expect("data" in r && r.data && (r.data as { a: string }).a).toBe("ok");
    expect(runner).toHaveBeenCalledTimes(4);
  });
  it("gives up after the attempts budget is exhausted", async () => {
    const runner = vi.fn().mockResolvedValue("never valid");
    const r = await generateStructured(S, "make a", { backend: "subscription", attempts: 3 }, runner);
    expect(r.data).toBeNull();
    expect(runner).toHaveBeenCalledTimes(3);
  });
});
