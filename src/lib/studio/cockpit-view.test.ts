import { describe, it, expect } from "vitest";
import { selectView } from "./cockpit-view";
import type { ScriptBeat } from "./schemas";

const beats: ScriptBeat[] = [
  { id: "b1", say: "line one", visualPrompt: "v1", do: "Click [A]", fx: "zoom" },
  { id: "b2", say: "line two", visualPrompt: "v2" },
  { id: "b3", say: "line three", visualPrompt: "v3" },
];

describe("selectView", () => {
  it("returns the active beat, the next peek, and progress", () => {
    const v = selectView(beats, 0);
    expect(v.current.say).toBe("line one");
    expect(v.current.do).toBe("Click [A]");
    expect(v.next?.say).toBe("line two");
    expect(v.progress).toEqual({ n: 1, total: 3 });
  });
  it("has no next peek on the last beat", () => {
    const v = selectView(beats, 2);
    expect(v.next).toBeNull();
    expect(v.progress).toEqual({ n: 3, total: 3 });
  });
  it("clamps an out-of-range index", () => {
    expect(selectView(beats, 99).current.say).toBe("line three");
    expect(selectView(beats, -5).current.say).toBe("line one");
  });
});
