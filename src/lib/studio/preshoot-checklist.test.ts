import { describe, it, expect } from "vitest";
import { checklistFor, allChecked, toggle } from "./preshoot-checklist";

describe("preshoot-checklist", () => {
  it("includes the universal audio + framing items", () => {
    const items = checklistFor("OBS");
    const ids = items.map((i) => i.id);
    expect(ids).toContain("notifications");
    expect(ids).toContain("mic-distance");
    expect(ids).toContain("framing");
  });
  it("adds a Rapidemo item for the Windows capture tool", () => {
    expect(checklistFor("OBS+Rapidemo").some((i) => i.id === "rapidemo")).toBe(true);
    expect(checklistFor("OBS").some((i) => i.id === "rapidemo")).toBe(false);
  });
  it("toggle flips a single item and allChecked reflects completion", () => {
    const items = checklistFor("OBS");
    let state: Record<string, boolean> = {};
    expect(allChecked(items, state)).toBe(false);
    items.forEach((i) => { state = toggle(state, i.id); });
    expect(allChecked(items, state)).toBe(true);
  });
});
