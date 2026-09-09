import { describe, it, expect } from "vitest";
import { setupBlockedByPinnedProfile } from "@/lib/auth/pinned-profile";

describe("setupBlockedByPinnedProfile", () => {
  it("blocks setup when the deployment is pinned and the user owns no profile", () => {
    expect(setupBlockedByPinnedProfile({ hasProfile: false, fixedProfileId: "p-fixed" })).toBe(true);
  });
  it("allows setup when the user already owns a profile", () => {
    expect(setupBlockedByPinnedProfile({ hasProfile: true, fixedProfileId: "p-fixed" })).toBe(false);
  });
  it("allows setup on an unpinned (multi-tenant) deployment", () => {
    expect(setupBlockedByPinnedProfile({ hasProfile: false, fixedProfileId: undefined })).toBe(false);
    expect(setupBlockedByPinnedProfile({ hasProfile: false, fixedProfileId: "" })).toBe(false);
  });
});
