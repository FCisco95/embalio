import { describe, it, expect } from "vitest";
import { daysUntilWindowExit, windowExitDate, EXPIRY_WARN_DAYS, clampWindowDays } from "./expiry";

// The scorecard reads `created_at >= now - windowDays` (server/gate.ts), so
// evidence silently disappears from the gate once it ages out. These helpers
// make that visible before it happens.
const KAI_CREATED = "2026-06-26T12:59:00.000Z"; // one of the two real acted alerts

describe("daysUntilWindowExit", () => {
  it("counts whole days left before an alert ages out of the window", () => {
    // created 06-26, 45d window => exits 08-10; from 08-02 that is 8 whole days
    expect(daysUntilWindowExit(KAI_CREATED, 45, new Date("2026-08-02T00:30:00Z"))).toBe(8);
  });

  it("returns 0 on the final day", () => {
    expect(daysUntilWindowExit(KAI_CREATED, 45, new Date("2026-08-10T06:00:00Z"))).toBe(0);
  });

  it("goes negative once the alert has already left the window", () => {
    expect(daysUntilWindowExit(KAI_CREATED, 45, new Date("2026-08-12T00:00:00Z"))).toBeLessThan(0);
  });

  it("widens with the window — the same alert is safe for far longer at 365d", () => {
    expect(daysUntilWindowExit(KAI_CREATED, 365, new Date("2026-08-02T00:30:00Z"))).toBe(328);
  });

  it("returns null for an unparseable timestamp rather than NaN", () => {
    expect(daysUntilWindowExit("not-a-date", 45, new Date("2026-08-02T00:00:00Z"))).toBeNull();
    expect(daysUntilWindowExit(null, 45, new Date("2026-08-02T00:00:00Z"))).toBeNull();
  });
});

describe("windowExitDate", () => {
  it("gives the UTC date the alert drops off", () => {
    expect(windowExitDate(KAI_CREATED, 45)).toBe("2026-08-10");
  });

  it("is null for an unparseable timestamp", () => {
    expect(windowExitDate("nope", 45)).toBeNull();
  });
});

describe("clampWindowDays", () => {
  it("defaults to 45 when unset or junk", () => {
    expect(clampWindowDays(undefined)).toBe(45);
    expect(clampWindowDays("abc")).toBe(45);
    expect(clampWindowDays("")).toBe(45);
  });

  it("accepts a widened review window", () => {
    expect(clampWindowDays("90")).toBe(90);
    expect(clampWindowDays("365")).toBe(365);
  });

  it("clamps out-of-range values instead of trusting the query string", () => {
    expect(clampWindowDays("0")).toBe(7);
    expect(clampWindowDays("-30")).toBe(7);
    expect(clampWindowDays("99999")).toBe(3650);
  });
});

describe("EXPIRY_WARN_DAYS", () => {
  it("warns a week ahead — enough notice to record an outcome", () => {
    expect(EXPIRY_WARN_DAYS).toBe(7);
  });
});
