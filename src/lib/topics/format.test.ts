import { describe, it, expect } from "vitest";
import { formatAgo } from "./format";

describe("formatAgo", () => {
  const now = Date.parse("2026-06-11T12:00:00Z");
  it("minutes", () => expect(formatAgo("2026-06-11T11:42:00Z", now)).toBe("18m ago"));
  it("just now under a minute", () => expect(formatAgo("2026-06-11T11:59:40Z", now)).toBe("just now"));
  it("hours", () => expect(formatAgo("2026-06-11T09:00:00Z", now)).toBe("3h ago"));
  it("days", () => expect(formatAgo("2026-06-09T12:00:00Z", now)).toBe("2d ago"));
  it("invalid date → null (caller must not render)", () => expect(formatAgo("garbage", now)).toBeNull());
});
