import { describe, it, expect } from "vitest";
import { resolveActiveProfile } from "@/lib/auth/active-profile";

const profiles = [{ id: "p-1" }, { id: "p-2" }, { id: "p-3" }];

describe("resolveActiveProfile", () => {
  it("returns the profile the cookie points at", () => {
    expect(resolveActiveProfile(profiles, "p-2")).toBe(profiles[1]);
  });

  it("falls back to the first profile when the cookie is absent", () => {
    expect(resolveActiveProfile(profiles, undefined)).toBe(profiles[0]);
  });

  it("falls back to the first profile when the cookie is stale or unknown", () => {
    expect(resolveActiveProfile(profiles, "deleted-profile")).toBe(profiles[0]);
  });

  it("returns null when the user owns no profile", () => {
    expect(resolveActiveProfile([], "p-2")).toBeNull();
    expect(resolveActiveProfile([], undefined)).toBeNull();
  });
});
