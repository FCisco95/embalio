import { describe, it, expect, vi } from "vitest";

// Next throws ReadonlyRequestCookiesError when cookies().set() runs inside a
// Server Component. Supabase calls setAll whenever it rotates a session, which
// getUser() does transparently once the access token has expired — so without
// a guard every page render after ~1h would 500. The proxy persists the tokens;
// here the write must simply not throw.
const set = vi.fn(() => {
  throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [{ name: "sb-x-auth-token", value: "v" }], set }),
}));

let captured: { getAll: () => unknown; setAll: (c: { name: string; value: string; options?: unknown }[]) => void } | null = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_u: string, _k: string, opts: { cookies: typeof captured }) => {
    captured = opts.cookies;
    return { auth: {} };
  },
}));

import { supabaseServer } from "@/lib/supabase/server";

describe("supabaseServer cookie adapter", () => {
  it("swallows the Server-Component cookie-write error instead of propagating it", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    await supabaseServer();
    expect(captured).not.toBeNull();
    expect(() => captured!.setAll([{ name: "sb-x-auth-token", value: "new" }])).not.toThrow();
    expect(set).toHaveBeenCalledTimes(1);
    expect(captured!.getAll()).toEqual([{ name: "sb-x-auth-token", value: "v" }]);
  });
});
