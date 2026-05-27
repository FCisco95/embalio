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
  it("ignores trailing prose that contains a stray brace", () => {
    const r = parseStructured(S, 'Here it is: {"a":"x"} note: keep under {280} chars');
    expect(r.ok && r.data.a).toBe("x");
  });
  it("ignores a stray brace pair BEFORE the real object", () => {
    const r = parseStructured(S, 'keeping under {280} chars, here: {"a":"x"}');
    expect(r.ok && r.data.a).toBe("x");
  });
  it("picks the valid object even inside a fenced block with preamble", () => {
    const r = parseStructured(S, 'sure {note}:\n```json\n{"a":"deep"}\n```');
    expect(r.ok && r.data.a).toBe("deep");
  });
});
