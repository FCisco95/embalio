import { describe, it, expect } from "vitest";
import { beatsFromProject } from "./overlay-data";

describe("beatsFromProject", () => {
  it("parses a valid script jsonb into a VideoScript", () => {
    const project = { script: { title: "T", hook: "H", beats: [{ id: "b1", say: "s", visualPrompt: "v" }] } };
    const script = beatsFromProject(project);
    expect(script?.beats).toHaveLength(1);
  });
  it("returns null when there is no script", () => {
    expect(beatsFromProject({ script: null })).toBeNull();
  });
  it("returns null for a malformed script", () => {
    expect(beatsFromProject({ script: { nope: true } })).toBeNull();
  });
});
