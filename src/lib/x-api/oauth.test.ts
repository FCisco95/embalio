import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  X_OAUTH_COOKIE,
  X_SCOPES,
  XOAuthError,
  buildXAuthUrl,
  exchangeCode,
  fetchMe,
  makePkce,
  refreshTokens,
} from "@/lib/x-api/oauth";

const TOKENS = { access_token: "at-new", refresh_token: "rt-new", expires_in: 7200, scope: "tweet.read tweet.write users.read offline.access" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("x-api/oauth", () => {
  const saved = { id: process.env.X_CLIENT_ID, secret: process.env.X_CLIENT_SECRET };
  beforeEach(() => {
    process.env.X_CLIENT_ID = "cid";
    process.env.X_CLIENT_SECRET = "csecret";
  });
  afterEach(() => {
    if (saved.id === undefined) delete process.env.X_CLIENT_ID;
    else process.env.X_CLIENT_ID = saved.id;
    if (saved.secret === undefined) delete process.env.X_CLIENT_SECRET;
    else process.env.X_CLIENT_SECRET = saved.secret;
  });

  it("exposes the scopes and cookie name", () => {
    expect(X_SCOPES).toEqual(["tweet.read", "tweet.write", "users.read", "offline.access"]);
    expect(X_OAUTH_COOKIE).toBe("x_oauth");
  });

  it("makePkce: challenge is base64url(sha256(verifier)) (S256)", () => {
    const { verifier, challenge } = makePkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(makePkce().verifier).not.toBe(verifier);
  });

  it("buildXAuthUrl carries all four scopes, S256 and the state", () => {
    const url = new URL(
      buildXAuthUrl({ clientId: "cid", redirectUri: "https://app.test/api/x/oauth/callback", state: "st", challenge: "ch" }),
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/api/x/oauth/callback");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")!.split(" ")).toEqual([...X_SCOPES]);
  });

  it("exchangeCode POSTs the form with Basic auth and the verifier", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(TOKENS));
    const out = await exchangeCode({ code: "c0de", verifier: "ver", redirectUri: "https://app.test/cb" }, fetchImpl);
    expect(out).toEqual(TOKENS);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.x.com/2/oauth2/token");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("cid:csecret").toString("base64")}`);
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("c0de");
    expect(body.get("code_verifier")).toBe("ver");
    expect(body.get("redirect_uri")).toBe("https://app.test/cb");
    expect(body.get("client_id")).toBe("cid");
  });

  it("refreshTokens parses the rotated pair", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(TOKENS));
    const out = await refreshTokens("rt-old", fetchImpl);
    expect(out.access_token).toBe("at-new");
    expect(out.refresh_token).toBe("rt-new");
    expect(out.expires_in).toBe(7200);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.x.com/2/oauth2/token");
    expect(init.headers.Authorization).toMatch(/^Basic /);
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-old");
  });

  it("surfaces invalid_grant as an XOAuthError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant", error_description: "Value passed for the token was invalid." }, 400));
    const err = await refreshTokens("dead", fetchImpl).catch((e) => e);
    expect(err).toBeInstanceOf(XOAuthError);
    expect(err.status).toBe(400);
    expect(err.error).toBe("invalid_grant");
  });

  it("throws when the client credentials are not configured", async () => {
    delete process.env.X_CLIENT_SECRET;
    await expect(refreshTokens("rt", vi.fn())).rejects.toThrow(/X_CLIENT_ID|X_CLIENT_SECRET/);
  });

  it("rejects a token response missing the refresh token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: "a", expires_in: 7200, scope: "x" }));
    await expect(refreshTokens("rt", fetchImpl)).rejects.toThrow(/refresh_token/);
  });

  it("fetchMe reads /2/users/me with the bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { id: "42", username: "cisco" } }));
    await expect(fetchMe("at", fetchImpl)).resolves.toEqual({ id: "42", username: "cisco" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.x.com/2/users/me");
    expect(init.headers.Authorization).toBe("Bearer at");
  });

  it("fetchMe throws on a non-2xx answer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 403));
    await expect(fetchMe("at", fetchImpl)).rejects.toThrow(/403/);
  });
});
