import { describe, it, expect } from "vitest";
import { localDate, isSameLocalDay } from "@/lib/retention/date";

describe("localDate", () => {
  it("formats a Date as server-local YYYY-MM-DD", () => {
    expect(localDate(new Date(2026, 5, 9, 23, 59))).toBe("2026-06-09");
    expect(localDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
  it("isSameLocalDay ignores time of day", () => {
    expect(isSameLocalDay(new Date(2026, 5, 9, 1), new Date(2026, 5, 9, 23))).toBe(true);
    expect(isSameLocalDay(new Date(2026, 5, 9), new Date(2026, 5, 10))).toBe(false);
  });
});
