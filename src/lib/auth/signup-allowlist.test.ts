import { describe, it, expect } from "vitest";
import { isSignupAllowed, parseSignupAllowlist } from "@/lib/auth/signup-allowlist";

describe("parseSignupAllowlist", () => {
  it("returns an empty list for unset / blank input", () => {
    expect(parseSignupAllowlist(undefined)).toEqual([]);
    expect(parseSignupAllowlist("")).toEqual([]);
    expect(parseSignupAllowlist(" , ,")).toEqual([]);
  });
  it("splits on commas, trims, lower-cases", () => {
    expect(parseSignupAllowlist(" Owner@Example.com, second@x.dev ")).toEqual(["owner@example.com", "second@x.dev"]);
  });
});

describe("isSignupAllowed", () => {
  it("fails closed when the allow-list is unset", () => {
    expect(isSignupAllowed("anyone@example.com", undefined)).toBe(false);
    expect(isSignupAllowed("anyone@example.com", "")).toBe(false);
  });
  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(isSignupAllowed("Owner@Example.com ", "owner@example.com")).toBe(true);
    expect(isSignupAllowed("owner@example.com", "a@b.c, OWNER@example.com")).toBe(true);
  });
  it("rejects emails not on the list", () => {
    expect(isSignupAllowed("stranger@example.com", "owner@example.com")).toBe(false);
  });
});
