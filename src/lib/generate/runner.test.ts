import { describe, it, expect } from "vitest";
import { buildClaudeArgs } from "@/lib/generate/runner";

describe("buildClaudeArgs", () => {
  it("uses print mode and no tools by default", () => {
    expect(buildClaudeArgs({})).toEqual(["-p"]);
  });
  it("allows web tools when research is requested", () => {
    expect(buildClaudeArgs({ research: true })).toEqual(["-p", "--allowedTools", "WebSearch", "WebFetch"]);
  });
});
