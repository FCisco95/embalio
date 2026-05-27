import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { generateText, generateStructured } from "@/lib/generate";

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
});
