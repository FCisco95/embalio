import { describe, it, expect, beforeEach } from "vitest";
import { makeMemoryStore, setPreset, getPreset } from "./teleprompter-store";
import { DEFAULT_LAYOUT } from "./teleprompter-layout";

describe("teleprompter-store", () => {
  let store: ReturnType<typeof makeMemoryStore>;
  beforeEach(() => {
    store = makeMemoryStore();
  });

  it("starts empty with no last layout", () => {
    expect(store.load()).toEqual({ presets: {}, last: null });
  });
  it("saves and recalls a named preset", () => {
    const big = { ...DEFAULT_LAYOUT, font: 40 };
    setPreset(store, "1", big);
    expect(getPreset(store, "1")).toEqual(big);
    expect(getPreset(store, "2")).toBeNull();
  });
  it("persists last layout across reload via the same backend", () => {
    const l = { ...DEFAULT_LAYOUT, opacity: 0.5 };
    store.save({ ...store.load(), last: l });
    expect(store.load().last).toEqual(l);
  });
});
