import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseStructured } from "@/lib/generate/parse";

const S = z.object({ a: z.string() });

describe("parseStructured", () => {
  it("parses a fenced ```json block", () => {
    const r = parseStructured(S, 'here:\n```json\n{"a":"x"}\n```\nthanks');
    expect(r.ok && r.data.a).toBe("x");
  });
  it("parses a bare object", () => {
    const r = parseStructured(S, '{"a":"y"}');
    expect(r.ok && r.data.a).toBe("y");
  });
  it("fails on invalid shape", () => {
    const r = parseStructured(S, '{"b":1}');
    expect(r.ok).toBe(false);
  });
  it("fails when no JSON present", () => {
    expect(parseStructured(S, "no json here").ok).toBe(false);
  });
});
