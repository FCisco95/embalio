import { describe, it, expect } from "vitest";
import { safeHref } from "@/lib/safe-url";

describe("safeHref", () => {
  it("passes through http(s) URLs", () => {
    expect(safeHref("https://x.com/cisco/status/1")).toBe("https://x.com/cisco/status/1");
    expect(safeHref("http://example.com")).toBe("http://example.com");
  });

  it("rejects javascript: URLs (XSS vector)", () => {
    expect(safeHref("javascript:alert(document.cookie)")).toBeUndefined();
    expect(safeHref("JavaScript:alert(1)")).toBeUndefined();
  });

  it("rejects data: and other non-http schemes", () => {
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHref("vbscript:msgbox(1)")).toBeUndefined();
  });

  it("rejects junk / relative / empty input", () => {
    expect(safeHref("not a url")).toBeUndefined();
    expect(safeHref("/relative/path")).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});
