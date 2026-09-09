import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const signUp = vi.fn();
const signInWithPassword = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { signUp: (a: unknown) => signUp(a), signInWithPassword: (a: unknown) => signInWithPassword(a) } }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); }) }));

import { signUpAction, signInAction } from "@/server/auth-actions";

function form(email: string, password = "longenough1") {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

const ORIGINAL = process.env.AUTH_SIGNUP_ALLOWLIST;
beforeEach(() => { signUp.mockReset(); signInWithPassword.mockReset(); });
afterEach(() => { if (ORIGINAL === undefined) delete process.env.AUTH_SIGNUP_ALLOWLIST; else process.env.AUTH_SIGNUP_ALLOWLIST = ORIGINAL; });

describe("signUpAction", () => {
  it("refuses everyone when AUTH_SIGNUP_ALLOWLIST is unset, without calling Supabase", async () => {
    delete process.env.AUTH_SIGNUP_ALLOWLIST;
    const out = await signUpAction(undefined, form("stranger@example.com"));
    expect(out).toEqual({ error: "Sign-up is closed for this deployment." });
    expect(signUp).not.toHaveBeenCalled();
  });
  it("refuses an email that is not on the list", async () => {
    process.env.AUTH_SIGNUP_ALLOWLIST = "owner@example.com";
    const out = await signUpAction(undefined, form("stranger@example.com"));
    expect(out?.error).toMatch(/closed/);
    expect(signUp).not.toHaveBeenCalled();
  });
  it("signs up an allow-listed email and redirects to /setup", async () => {
    process.env.AUTH_SIGNUP_ALLOWLIST = "Owner@Example.com";
    signUp.mockResolvedValueOnce({ error: null });
    await expect(signUpAction(undefined, form("owner@example.com"))).rejects.toThrow("REDIRECT:/setup");
    expect(signUp).toHaveBeenCalledWith({ email: "owner@example.com", password: "longenough1" });
  });
  it("still validates credentials before consulting the list", async () => {
    process.env.AUTH_SIGNUP_ALLOWLIST = "owner@example.com";
    const out = await signUpAction(undefined, form("owner@example.com", "short"));
    expect(out?.error).toMatch(/8 characters/);
  });
});

describe("signInAction", () => {
  it("is not gated by the allow-list", async () => {
    delete process.env.AUTH_SIGNUP_ALLOWLIST;
    signInWithPassword.mockResolvedValueOnce({ error: null });
    await expect(signInAction(undefined, form("owner@example.com"))).rejects.toThrow("REDIRECT:/");
  });
  it("surfaces the Supabase error message", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    await expect(signInAction(undefined, form("owner@example.com"))).resolves.toEqual({ error: "Invalid login credentials" });
  });
});
