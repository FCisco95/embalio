import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const cookieSet = vi.fn();
const assertOwnProfile = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet }) }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/server/auth", () => ({ assertOwnProfile: (id: string) => assertOwnProfile(id) }));

beforeEach(() => {
  vi.resetModules();
  cookieSet.mockReset();
  assertOwnProfile.mockReset();
  revalidatePath.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("setActiveProfile", () => {
  it("throws before touching the cookie when the profile is not the caller's", async () => {
    assertOwnProfile.mockRejectedValue(new Error("Profile not found or access denied"));
    const { setActiveProfile } = await import("@/server/active-profile-actions");
    await expect(setActiveProfile("foreign")).rejects.toThrow("Profile not found or access denied");
    expect(cookieSet).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sets the httpOnly embalio_profile cookie for one year and revalidates the layout", async () => {
    assertOwnProfile.mockResolvedValue(undefined);
    const { setActiveProfile } = await import("@/server/active-profile-actions");
    await setActiveProfile("p-2");
    expect(assertOwnProfile).toHaveBeenCalledWith("p-2");
    expect(cookieSet).toHaveBeenCalledWith("embalio_profile", "p-2", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 31536000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("marks the cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    assertOwnProfile.mockResolvedValue(undefined);
    const { setActiveProfile } = await import("@/server/active-profile-actions");
    await setActiveProfile("p-2");
    expect(cookieSet).toHaveBeenCalledWith(
      "embalio_profile",
      "p-2",
      expect.objectContaining({ secure: true }),
    );
  });
});
