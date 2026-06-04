import { describe, it, expect } from "vitest";
import { DEFAULT_LAYOUT, clampLayout, adjust } from "./teleprompter-layout";

describe("teleprompter-layout", () => {
  it("has sane defaults", () => {
    expect(DEFAULT_LAYOUT.font).toBe(24);
    expect(DEFAULT_LAYOUT.opacity).toBeCloseTo(0.7);
    expect(DEFAULT_LAYOUT.mode).toBe("para");
  });
  it("clamps font and opacity into range", () => {
    expect(clampLayout({ ...DEFAULT_LAYOUT, font: 999 }).font).toBe(60);
    expect(clampLayout({ ...DEFAULT_LAYOUT, font: 2 }).font).toBe(16);
    expect(clampLayout({ ...DEFAULT_LAYOUT, opacity: 5 }).opacity).toBe(1);
    expect(clampLayout({ ...DEFAULT_LAYOUT, opacity: 0 }).opacity).toBeCloseTo(0.2);
  });
  it("adjust('font', +2) bumps and re-clamps", () => {
    expect(adjust(DEFAULT_LAYOUT, "font", 2).font).toBe(26);
    expect(adjust({ ...DEFAULT_LAYOUT, font: 60 }, "font", 2).font).toBe(60);
  });
  it("adjust('opacity', -0.05) reduces", () => {
    expect(adjust(DEFAULT_LAYOUT, "opacity", -0.05).opacity).toBeCloseTo(0.65);
  });
  it("clamps width and height into range", () => {
    expect(clampLayout({ ...DEFAULT_LAYOUT, width: 9999 }).width).toBe(3840);
    expect(clampLayout({ ...DEFAULT_LAYOUT, height: 10 }).height).toBe(70);
  });
  it("non-finite values clamp to the floor instead of propagating", () => {
    expect(adjust(DEFAULT_LAYOUT, "opacity", NaN).opacity).toBeCloseTo(0.2);
    expect(clampLayout({ ...DEFAULT_LAYOUT, font: Infinity }).font).toBe(60);
  });
});
