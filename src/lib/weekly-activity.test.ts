import { describe, it, expect } from "vitest";
import { getWeekStart } from "./weekly-activity";

describe("getWeekStart", () => {
  it("returns self when now is Monday", () => {
    // 2026-06-08 is a Monday
    const mon = new Date("2026-06-08T14:30:00Z");
    expect(getWeekStart(mon).toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });

  it("returns prior Monday for mid-week day", () => {
    // 2026-06-11 is a Thursday
    const thu = new Date("2026-06-11T09:00:00Z");
    expect(getWeekStart(thu).toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });

  it("returns prior Monday for Sunday", () => {
    // 2026-06-14 is a Sunday
    const sun = new Date("2026-06-14T23:59:00Z");
    expect(getWeekStart(sun).toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });

  it("handles month boundary crossing", () => {
    // 2026-07-01 is a Wednesday → prior Monday is 2026-06-29
    const wed = new Date("2026-07-01T00:00:00Z");
    expect(getWeekStart(wed).toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("returns zero time (no hours/minutes/seconds)", () => {
    const fri = new Date("2026-06-12T22:45:00Z");
    const ws = getWeekStart(fri);
    expect(ws.getUTCHours()).toBe(0);
    expect(ws.getUTCMinutes()).toBe(0);
    expect(ws.getUTCSeconds()).toBe(0);
    expect(ws.getUTCMilliseconds()).toBe(0);
  });
});
