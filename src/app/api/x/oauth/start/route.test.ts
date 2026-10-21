import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  requireSessionUser: vi.fn(),
  assertOwnProfile: vi.fn(),
}));

import { GET } from "@/app/api/x/oauth/start/route";
import { assertOwnProfile, requireSessionUser } from "@/server/auth";

const ORIGIN = "https://app.test";
const call = (qs = "?profile=p-1") => GET(new NextRequest(`${ORIGIN}/api/x/oauth/start${qs}`));

describe("GET /api/x/oauth/start", () => {
  const saved = process.env.X_CLIENT_ID;
  beforeEach(() => {
    process.env.X_CLIENT_ID = "cid";
    vi.mocked(requireSessionUser).mockReset().mockResolvedValue({ id: "u-1" } as any);
    vi.mocked(assertOwnProfile).mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.X_CLIENT_ID;
    else process.env.X_CLIENT_ID = saved;
  });

  it("400 without a profile param", async () => {
    expect((await call("")).status).toBe(400);
  });

  it("403 for a profile the session does not own", async () => {
    vi.mocked(assertOwnProfile).mockRejectedValue(new Error("Profile not found or access denied"));
    expect((await call()).status).toBe(403);
  });

  it("500 when X_CLIENT_ID is not configured", async () => {
    delete process.env.X_CLIENT_ID;
    expect((await call()).status).toBe(500);
  });

  it("sets the HttpOnly state cookie and redirects to X's authorize URL with PKCE", async () => {
    const res = await call();
    expect(res.status).toBe(307);

    const loc = new URL(res.headers.get("location")!);
    expect(`${loc.origin}${loc.pathname}`).toBe("https://x.com/i/oauth2/authorize");
    expect(loc.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/x/oauth/callback`);
    expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
    expect(loc.searchParams.get("scope")).toContain("offline.access");

    const cookie = res.cookies.get("x_oauth")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/api/x/oauth");
    expect(cookie.maxAge).toBe(600);
    const payload = JSON.parse(cookie.value);
    expect(payload.profileId).toBe("p-1");
    expect(payload.state).toBe(loc.searchParams.get("state"));
    expect(typeof payload.verifier).toBe("string");
  });
});
