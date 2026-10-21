import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
const listProfiles = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));
vi.mock("@/server/profiles", () => ({ listProfiles: () => listProfiles() }));

const P1 = { id: "p-1", handle: "one" };
const P2 = { id: "p-2", handle: "two" };

beforeEach(() => {
  vi.resetModules();
  cookieGet.mockReset();
  listProfiles.mockReset();
});

describe("getActiveProfile", () => {
  it("resolves the profile named by the embalio_profile cookie", async () => {
    listProfiles.mockResolvedValue([P1, P2]);
    cookieGet.mockReturnValue({ name: "embalio_profile", value: "p-2" });
    const { getActiveProfile, ACTIVE_PROFILE_COOKIE } = await import("@/server/active-profile");
    await expect(getActiveProfile()).resolves.toBe(P2);
    expect(ACTIVE_PROFILE_COOKIE).toBe("embalio_profile");
    expect(cookieGet).toHaveBeenCalledWith("embalio_profile");
  });

  it("falls back to the first profile on a stale cookie", async () => {
    listProfiles.mockResolvedValue([P1, P2]);
    cookieGet.mockReturnValue({ name: "embalio_profile", value: "gone" });
    const { getActiveProfile } = await import("@/server/active-profile");
    await expect(getActiveProfile()).resolves.toBe(P1);
  });

  it("returns null when the user has no profiles", async () => {
    listProfiles.mockResolvedValue([]);
    cookieGet.mockReturnValue(undefined);
    const { getActiveProfile } = await import("@/server/active-profile");
    await expect(getActiveProfile()).resolves.toBeNull();
  });
});

describe("requireActiveProfile", () => {
  it("returns the active profile", async () => {
    listProfiles.mockResolvedValue([P1, P2]);
    cookieGet.mockReturnValue({ name: "embalio_profile", value: "p-1" });
    const { requireActiveProfile } = await import("@/server/active-profile");
    await expect(requireActiveProfile()).resolves.toBe(P1);
  });

  it("redirects to /setup when there is no profile", async () => {
    listProfiles.mockResolvedValue([]);
    cookieGet.mockReturnValue(undefined);
    const { requireActiveProfile } = await import("@/server/active-profile");
    await expect(requireActiveProfile()).rejects.toThrow("REDIRECT:/setup");
  });
});
