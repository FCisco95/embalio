import { describe, it, expect } from "vitest";
import { fitBadge, freshnessLabel } from "@/lib/engagement/present";

describe("fitBadge", () => {
  it("labels an in-band author with its multiple and inBand=true", () => {
    const b = fitBadge(25000, 2750); // ~9x
    expect(b.inBand).toBe(true);
    expect(b.label).toMatch(/9× your size/);
  });
  it("flags a mega account as a visibility play (out of band)", () => {
    const b = fitBadge(5_000_000, 2750);
    expect(b.inBand).toBe(false);
    expect(b.label).toMatch(/big acct/i);
  });
  it("handles unknown owner size without throwing", () => {
    expect(() => fitBadge(1000, 0)).not.toThrow();
  });
});

describe("freshnessLabel", () => {
  const now = new Date("2026-06-01T12:00:00Z").getTime();
  it("renders minutes for fresh posts", () => {
    expect(freshnessLabel("2026-06-01T11:54:00Z", now)).toBe("6 min ago");
  });
  it("renders hours for older posts", () => {
    expect(freshnessLabel("2026-06-01T09:00:00Z", now)).toBe("3h ago");
  });
});
