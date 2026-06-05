import { describe, it, expect, beforeEach } from "vitest";
import { makeMemoryStore } from "./teleprompter-store";
import { DEFAULT_LAYOUT } from "./teleprompter-layout";

describe("teleprompter-store", () => {
  let store: ReturnType<typeof makeMemoryStore>;
  beforeEach(() => {
    store = makeMemoryStore();
  });

  it("starts empty with no last layout", () => {
    expect(store.load()).toEqual({ last: null });
  });
  it("persists last layout across reload via the same backend", () => {
    const l = { ...DEFAULT_LAYOUT, opacity: 0.5 };
    store.save({ ...store.load(), last: l });
    expect(store.load().last).toEqual(l);
  });
  it("save snapshots the data — later mutations don't leak in", () => {
    const l = { ...DEFAULT_LAYOUT, font: 40 };
    store.save({ last: l });
    l.font = 99;
    expect(store.load().last?.font).toBe(40);
  });
});
