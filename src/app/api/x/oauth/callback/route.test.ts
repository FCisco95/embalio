import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  requireSessionUser: vi.fn(),
  assertOwnProfile: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));
vi.mock("@/lib/x-api/oauth", async (orig) => ({
  ...(await orig<typeof import("@/lib/x-api/oauth")>()),
  exchangeCode: vi.fn(),
  fetchMe: vi.fn(),
}));

import { GET } from "@/app/api/x/oauth/callback/route";
import { assertOwnProfile } from "@/server/auth";
import { supabaseService } from "@/lib/supabase/server";
import { exchangeCode, fetchMe } from "@/lib/x-api/oauth";
import { decryptSecret } from "@/lib/x-api/crypto";

const ORIGIN = "https://app.test";
const COOKIE = { state: "state-abc", verifier: "ver-xyz", profileId: "p-1" };

function req(opts: { state?: string; code?: string | null; cookie?: unknown; error?: string } = {}): NextRequest {
  const u = new URL(`${ORIGIN}/api/x/oauth/callback`);
  const code = opts.code === undefined ? "auth-code" : opts.code;
  if (code) u.searchParams.set("code", code);
  u.searchParams.set("state", opts.state ?? COOKIE.state);
  if (opts.error) u.searchParams.set("error", opts.error);
  const cookie = opts.cookie === undefined ? COOKIE : opts.cookie;
  return new NextRequest(u, {
    headers: cookie ? { cookie: `x_oauth=${encodeURIComponent(typeof cookie === "string" ? cookie : JSON.stringify(cookie))}` } : {},
  });
}

function sbWithUpsert(upsertError: { code: string; message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  const sb = { from: vi.fn(() => ({ upsert })) };
  vi.mocked(supabaseService).mockReturnValue(sb as any);
  return { sb, upsert };
}

describe("GET /api/x/oauth/callback", () => {
  const saved = process.env.X_TOKEN_ENC_KEY;
  beforeEach(() => {
    process.env.X_TOKEN_ENC_KEY = randomBytes(32).toString("base64");
    vi.mocked(assertOwnProfile).mockReset().mockResolvedValue(undefined);
    vi.mocked(exchangeCode).mockReset().mockResolvedValue({
      access_token: "at-1",
      refresh_token: "rt-1",
      expires_in: 7200,
      scope: "tweet.read tweet.write users.read offline.access",
    });
    vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: "777", username: "cisco" });
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.X_TOKEN_ENC_KEY;
    else process.env.X_TOKEN_ENC_KEY = saved;
  });

  it("403 when the echoed state does not match the cookie", async () => {
    sbWithUpsert();
    const res = await GET(req({ state: "forged" }));
    expect(res.status).toBe(403);
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it("403 when the state cookie is missing or malformed", async () => {
    sbWithUpsert();
    expect((await GET(req({ cookie: null }))).status).toBe(403);
    expect((await GET(req({ cookie: "not-json" }))).status).toBe(403);
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it("400 when the code is missing", async () => {
    sbWithUpsert();
    const res = await GET(req({ code: null }));
    expect(res.status).toBe(400);
  });

  it("redirects back with x=denied when the user declined on X", async () => {
    sbWithUpsert();
    const res = await GET(req({ code: null, error: "access_denied" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/profiles?x=denied`);
  });

  it("403 when the cookie's profile is not owned by the live session (and spends nothing)", async () => {
    sbWithUpsert();
    vi.mocked(assertOwnProfile).mockRejectedValue(new Error("Profile not found or access denied"));
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(assertOwnProfile).toHaveBeenCalledWith("p-1");
    expect(exchangeCode).not.toHaveBeenCalled();
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it("happy path: stores encrypted tokens, clears the cookie, redirects to /profiles?x=connected", async () => {
    const { upsert } = sbWithUpsert();
    const res = await GET(req());

    expect(exchangeCode).toHaveBeenCalledWith({
      code: "auth-code",
      verifier: "ver-xyz",
      redirectUri: `${ORIGIN}/api/x/oauth/callback`,
    });
    expect(fetchMe).toHaveBeenCalledWith("at-1");

    expect(upsert).toHaveBeenCalledTimes(1);
    const [row, opts] = upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "profile_id" });
    expect(row).toMatchObject({
      profile_id: "p-1",
      x_user_id: "777",
      x_username: "cisco",
      needs_reauth: false,
      last_error: null,
      scopes: "tweet.read tweet.write users.read offline.access",
    });
    expect(row.access_token_enc).not.toContain("at-1");
    expect(row.refresh_token_enc).not.toContain("rt-1");
    expect(decryptSecret(row.access_token_enc)).toBe("at-1");
    expect(decryptSecret(row.refresh_token_enc)).toBe("rt-1");
    expect(new Date(row.access_expires_at).getTime()).toBeGreaterThan(Date.now() + 100 * 60_000);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/profiles?x=connected`);
    const cleared = res.cookies.get("x_oauth");
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
    expect(cleared?.path).toBe("/api/x/oauth");
  });

  it("x_user_id unique violation (23505) redirects to already-linked with the handle", async () => {
    sbWithUpsert({ code: "23505", message: "duplicate key value violates unique constraint" });
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/profiles?x=already-linked&handle=cisco`);
    expect(res.cookies.get("x_oauth")?.maxAge).toBe(0);
  });

  it("other write errors redirect to x=error without echoing the database message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sbWithUpsert({ code: "XX000", message: "relation \"x_accounts\" secret detail" });
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/profiles?x=error`);
    expect(res.headers.get("location")).not.toContain("secret");
    expect(await res.text()).not.toContain("secret");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("a failed code exchange redirects with x=error instead of throwing", async () => {
    sbWithUpsert();
    vi.mocked(exchangeCode).mockRejectedValue(new Error("token endpoint 400"));
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/profiles?x=error`);
  });
});
