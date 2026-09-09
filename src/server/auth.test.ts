import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();
const fromFn = vi.fn(() => ({
  select: () => ({
    eq: () => ({
      order: () => ({ limit: () => ({ maybeSingle }) }),
      eq: () => ({ maybeSingle }),
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser: () => getUser() }, from: fromFn }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); }) }));

import { getSessionUser, getCurrentProfile, assertOwnProfile } from "@/server/auth";

beforeEach(() => {
  getUser.mockReset();
  maybeSingle.mockReset();
});

describe("getSessionUser", () => {
  it("returns the user when the session verifies", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u-1" } }, error: null });
    await expect(getSessionUser()).resolves.toEqual({ id: "u-1" });
  });
  it("returns null on an auth error", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "Auth session missing!" } });
    await expect(getSessionUser()).resolves.toBeNull();
  });
  it("returns null (does not throw) when the client throws — stale cookie, cookie-write error", async () => {
    getUser.mockRejectedValueOnce(new Error("Cookies can only be modified in a Server Action or Route Handler."));
    await expect(getSessionUser()).resolves.toBeNull();
  });
});

describe("getCurrentProfile", () => {
  it("returns null when signed out without touching profiles", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "no" } });
    await expect(getCurrentProfile()).resolves.toBeNull();
    expect(maybeSingle).not.toHaveBeenCalled();
  });
  it("returns the oldest profile owned by the session user", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u-1" } }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { id: "p-1", handle: "fcisco95" }, error: null });
    await expect(getCurrentProfile()).resolves.toEqual({ id: "p-1", handle: "fcisco95" });
  });
});

describe("assertOwnProfile", () => {
  it("throws when the profile is not owned by the session user", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u-1" } }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(assertOwnProfile("p-other")).rejects.toThrow(/access denied/);
  });
});
