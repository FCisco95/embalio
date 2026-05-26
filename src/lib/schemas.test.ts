import { describe, it, expect } from "vitest";
import { DraftOutput } from "@/lib/schemas";

describe("DraftOutput", () => {
  it("accepts a valid draft", () => {
    const r = DraftOutput.safeParse({ body: "gm builders", suggestedVisual: "screenshot of the dashboard" });
    expect(r.success).toBe(true);
  });
  it("allows suggestedVisual to be omitted", () => {
    const r = DraftOutput.safeParse({ body: "hello" });
    expect(r.success).toBe(true);
  });
  it("rejects an empty body", () => {
    const r = DraftOutput.safeParse({ body: "" });
    expect(r.success).toBe(false);
  });
  it("rejects a body over 280 chars", () => {
    const r = DraftOutput.safeParse({ body: "x".repeat(281) });
    expect(r.success).toBe(false);
  });
});
