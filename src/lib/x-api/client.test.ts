import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getXClientForProfile } from "@/lib/x-api/client";
import { decryptSecret, encryptSecret } from "@/lib/x-api/crypto";
import { XRateLimited, XReauthRequired, XTransportError } from "@/lib/x-api/types";
import { XApiError } from "@/lib/x-api/client";

const API = "https://api.x.com/2";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";

type Row = Record<string, any>;

function baseRow(over: Row = {}): Row {
  return {
    profile_id: "p-1",
    x_user_id: "999",
    x_username: "cisco",
    access_token_enc: encryptSecret("at-old"),
    refresh_token_enc: encryptSecret("rt-old"),
    access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    scopes: "tweet.read tweet.write users.read offline.access",
    token_version: 3,
    needs_reauth: false,
    last_refresh_at: null,
    last_error: null,
    ...over,
  };
}

/** Stateful single-table fake: models the `token_version` compare-and-swap. */
function makeSb(initial: Row | null) {
  const state = { row: initial ? { ...initial } : null, updates: [] as Array<{ patch: Row; filters: Row }>, beforeUpdate: undefined as undefined | (() => void) };
  const qb = () => {
    let mode: "select" | "update" = "select";
    let patch: Row = {};
    const filters: Row = {};
    const exec = async () => {
      if (mode === "update") {
        state.updates.push({ patch, filters });
        state.beforeUpdate?.();
        const row = state.row;
        if (row && (filters.token_version === undefined || row.token_version === filters.token_version)) {
          state.row = { ...row, ...patch };
          return { data: [{ profile_id: row.profile_id }], error: null };
        }
        return { data: [], error: null };
      }
      return { data: state.row, error: null };
    };
    const b: any = {
      select: () => b,
      update: (p: Row) => ((mode = "update"), (patch = p), b),
      eq: (k: string, v: unknown) => ((filters[k] = v), b),
      maybeSingle: () => exec(),
      then: (res: any, rej: any) => exec().then(res, rej),
    };
    return b;
  };
  return { state, sb: { from: vi.fn(() => qb()) } as any };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

const NEW_TOKENS = { access_token: "at-new", refresh_token: "rt-new", expires_in: 7200, scope: "tweet.read tweet.write users.read offline.access" };

describe("getXClientForProfile", () => {
  const saved = { k: process.env.X_TOKEN_ENC_KEY, i: process.env.X_CLIENT_ID, s: process.env.X_CLIENT_SECRET };
  beforeEach(() => {
    process.env.X_TOKEN_ENC_KEY = randomBytes(32).toString("base64");
    process.env.X_CLIENT_ID = "cid";
    process.env.X_CLIENT_SECRET = "csecret";
  });
  afterEach(() => {
    for (const [k, v] of [["X_TOKEN_ENC_KEY", saved.k], ["X_CLIENT_ID", saved.i], ["X_CLIENT_SECRET", saved.s]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  // Rows must be built after the key is set, so build lazily.
  const fresh = (over: Row = {}) => baseRow(over);

  it("exposes profile/user identity from x_accounts", async () => {
    const { sb } = makeSb(fresh());
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: vi.fn() });
    expect(c.profileId).toBe("p-1");
    expect(c.xUserId).toBe("999");
    expect(c.username).toBe("cisco");
    expect(c.estimatedCostUsd).toBe(0);
  });

  it("throws when no account is linked", async () => {
    const { sb } = makeSb(null);
    await expect(getXClientForProfile("p-1", sb, { fetchImpl: vi.fn() })).rejects.toThrow(/no X account/i);
  });

  it("throws XReauthRequired up front when the row is flagged needs_reauth", async () => {
    const fetchImpl = vi.fn();
    const { sb } = makeSb(fresh({ needs_reauth: true }));
    await expect(getXClientForProfile("p-1", sb, { fetchImpl })).rejects.toBeInstanceOf(XReauthRequired);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not refresh a token that is comfortably valid", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ data: { id: "999", username: "cisco" } }));
    const { sb, state } = makeSb(fresh());
    const c = await getXClientForProfile("p-1", sb, { fetchImpl });
    await c.getMe();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain(`${API}/users/me`);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer at-old");
    expect(state.updates).toHaveLength(0);
  });

  it("refreshes pre-emptively when the access token expires within 5 minutes, and persists the rotation behind the token_version guard", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url === TOKEN_URL ? json(NEW_TOKENS) : json({ data: { id: "999", username: "cisco" } }),
    );
    const { sb, state } = makeSb(fresh({ access_expires_at: new Date(Date.now() + 2 * 60_000).toISOString() }));
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
    await c.getMe();

    const calls = fetchImpl.mock.calls as any[];
    expect(calls[0][0]).toBe(TOKEN_URL);
    expect(new URLSearchParams(calls[0][1].body).get("refresh_token")).toBe("rt-old");
    expect(calls[1][1].headers.Authorization).toBe("Bearer at-new");

    expect(state.updates).toHaveLength(1);
    const { patch, filters } = state.updates[0];
    expect(filters).toMatchObject({ profile_id: "p-1", token_version: 3 });
    expect(patch.token_version).toBe(4);
    expect(decryptSecret(patch.access_token_enc)).toBe("at-new");
    expect(decryptSecret(patch.refresh_token_enc)).toBe("rt-new");
    expect(patch.access_token_enc).not.toContain("at-new");
    expect(new Date(patch.access_expires_at).getTime()).toBeGreaterThan(Date.now() + 60 * 60_000);
    expect(patch.last_refresh_at).toBeTruthy();
  });

  it("on a 401 refreshes once and retries the request", async () => {
    let apiCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === TOKEN_URL) return json(NEW_TOKENS);
      apiCalls += 1;
      return apiCalls === 1 ? json({ title: "Unauthorized" }, 401) : json({ data: { id: "999", username: "cisco" } });
    });
    const { sb } = makeSb(fresh());
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
    const me = await c.getMe();
    expect(me.username).toBe("cisco");
    const calls = fetchImpl.mock.calls as any[];
    expect(calls.map((x) => x[0] === TOKEN_URL)).toEqual([false, true, false]);
    expect(calls[2][1].headers.Authorization).toBe("Bearer at-new");
  });

  it("does not loop: a second 401 after the refresh is an error", async () => {
    const fetchImpl = vi.fn(async (url: string) => (url === TOKEN_URL ? json(NEW_TOKENS) : json({ title: "Unauthorized" }, 401)));
    const { sb } = makeSb(fresh());
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
    await expect(c.getMe()).rejects.toThrow(/401/);
    expect((fetchImpl.mock.calls as any[]).filter((x) => x[0] === TOKEN_URL)).toHaveLength(1);
  });

  it("lost rotation race: re-reads and uses the pair another process stored", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url === TOKEN_URL ? json(NEW_TOKENS) : json({ data: { id: "999", username: "cisco" } }),
    );
    const { sb, state } = makeSb(fresh({ access_expires_at: new Date(Date.now() - 1000).toISOString() }));
    state.beforeUpdate = () => {
      // Another process commits its rotation between our refresh and our UPDATE.
      state.row = {
        ...state.row!,
        token_version: 4,
        access_token_enc: encryptSecret("at-winner"),
        refresh_token_enc: encryptSecret("rt-winner"),
        access_expires_at: new Date(Date.now() + 7200_000).toISOString(),
      };
    };
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
    await c.getMe();
    const apiCall = (fetchImpl.mock.calls as any[]).find((x) => x[0] !== TOKEN_URL);
    expect(apiCall[1].headers.Authorization).toBe("Bearer at-winner");
    expect(state.row!.access_token_enc).not.toBe(encryptSecret("at-new")); // our pair was NOT written
    expect(decryptSecret(state.row!.refresh_token_enc)).toBe("rt-winner");
  });

  it("invalid_grant with no concurrent rotation flags needs_reauth and throws XReauthRequired", async () => {
    const fetchImpl = vi.fn(async () => json({ error: "invalid_grant", error_description: "bad" }, 400));
    const { sb, state } = makeSb(fresh({ access_expires_at: new Date(Date.now() - 1000).toISOString() }));
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
    await expect(c.getMe()).rejects.toBeInstanceOf(XReauthRequired);
    expect(state.row!.needs_reauth).toBe(true);
    expect(state.row!.last_error).toMatch(/invalid_grant/);
  });

  it("invalid_grant because another process already rotated: uses the stored pair, no reauth flag", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url === TOKEN_URL ? json({ error: "invalid_grant" }, 400) : json({ data: { id: "999", username: "cisco" } }),
    );
    const { sb, state } = makeSb(fresh({ access_expires_at: new Date(Date.now() - 1000).toISOString() }));
    // The winner commits while our (now-dead) refresh is in flight.
    const origFetch = fetchImpl.getMockImplementation()!;
    fetchImpl.mockImplementation(async (url: string) => {
      if (url === TOKEN_URL) {
        state.row = {
          ...state.row!,
          token_version: 4,
          access_token_enc: encryptSecret("at-winner"),
          refresh_token_enc: encryptSecret("rt-winner"),
          access_expires_at: new Date(Date.now() + 7200_000).toISOString(),
        };
      }
      return origFetch(url);
    });
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
    await c.getMe();
    expect(state.row!.needs_reauth).toBe(false);
    const apiCall = (fetchImpl.mock.calls as any[]).find((x) => x[0] !== TOKEN_URL);
    expect(apiCall[1].headers.Authorization).toBe("Bearer at-winner");
  });

  it("invalid_grant whose re-read happens BEFORE the winner commits: the guarded needs_reauth write loses, the stored pair is adopted", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url === TOKEN_URL ? json({ error: "invalid_grant" }, 400) : json({ data: { id: "999", username: "cisco" } }),
    );
    const { sb, state } = makeSb(fresh({ access_expires_at: new Date(Date.now() - 1000).toISOString() }));
    // Our re-read still sees v3; the winner commits right before our needs_reauth UPDATE lands.
    state.beforeUpdate = () => {
      state.beforeUpdate = undefined;
      state.row = {
        ...state.row!,
        token_version: 4,
        access_token_enc: encryptSecret("at-winner"),
        refresh_token_enc: encryptSecret("rt-winner"),
        access_expires_at: new Date(Date.now() + 7200_000).toISOString(),
      };
    };
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
    await c.getMe();

    expect(state.updates[0].filters).toMatchObject({ profile_id: "p-1", token_version: 3 });
    expect(state.row!.needs_reauth).toBe(false);
    expect(state.row!.last_error).toBeNull();
    const apiCall = (fetchImpl.mock.calls as any[]).find((x) => x[0] !== TOKEN_URL);
    expect(apiCall[1].headers.Authorization).toBe("Bearer at-winner");
  });

  it("a successful rotation clears a stale needs_reauth flag", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url === TOKEN_URL ? json(NEW_TOKENS) : json({ data: { id: "999", username: "cisco" } }),
    );
    const { sb, state } = makeSb(fresh({ access_expires_at: new Date(Date.now() - 1000).toISOString() }));
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
    await c.getMe();
    expect(state.updates[0].patch).toMatchObject({ needs_reauth: false, last_error: null });
  });

  it("every API request carries an abort signal", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ data: { id: "999", username: "cisco" } }));
    const { sb } = makeSb(fresh());
    const c = await getXClientForProfile("p-1", sb, { fetchImpl });
    await c.getMe();
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  describe("transport failures are distinguishable from X rejections", () => {
    it("a fetch that times out/aborts after dispatch throws XTransportError (the request may have landed)", async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
      const { sb } = makeSb(fresh());
      const c = await getXClientForProfile("p-1", sb, { fetchImpl });
      const err = await c.createTweet({ text: "hi" }).catch((e) => e);
      expect(err).toBeInstanceOf(XTransportError);
      expect(err.message).toMatch(/timed out/i);
      expect(c.estimatedCostUsd).toBe(0);
    });

    it("a network error is a transport error", async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
      const { sb } = makeSb(fresh());
      const c = await getXClientForProfile("p-1", sb, { fetchImpl });
      await expect(c.createTweet({ text: "hi" })).rejects.toBeInstanceOf(XTransportError);
    });

    it("a response whose body is cut off (2xx, then the read fails) is a transport error", async () => {
      const cut = { ok: true, status: 201, headers: new Headers(), json: () => Promise.reject(new TypeError("terminated")) };
      const fetchImpl = vi.fn().mockResolvedValue(cut);
      const { sb } = makeSb(fresh());
      const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
      await expect(c.createTweet({ text: "hi" })).rejects.toBeInstanceOf(XTransportError);
    });

    it("a retry after a 401 that then times out is still a transport error", async () => {
      let api = 0;
      const fetchImpl = vi.fn(async (url: string) => {
        if (url === TOKEN_URL) return json(NEW_TOKENS);
        api += 1;
        if (api === 1) return json({ title: "Unauthorized" }, 401);
        throw new DOMException("timed out", "TimeoutError");
      });
      const { sb } = makeSb(fresh());
      const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });
      await expect(c.createTweet({ text: "hi" })).rejects.toBeInstanceOf(XTransportError);
    });

    it("an HTTP error status is an XApiError carrying the status, NOT a transport error", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(json({ title: "Forbidden" }, 403));
      const { sb } = makeSb(fresh());
      const c = await getXClientForProfile("p-1", sb, { fetchImpl });
      const err = await c.createTweet({ text: "hi" }).catch((e) => e);
      expect(err).toBeInstanceOf(XApiError);
      expect(err).not.toBeInstanceOf(XTransportError);
      expect(err.status).toBe(403);
    });

    it("a 500 is also a definite rejection", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(json({}, 500));
      const { sb } = makeSb(fresh());
      const c = await getXClientForProfile("p-1", sb, { fetchImpl });
      const err = await c.createTweet({ text: "hi" }).catch((e) => e);
      expect(err).toBeInstanceOf(XApiError);
      expect(err.status).toBe(500);
    });
  });

  it("HTTP 429 throws XRateLimited with the reset time", async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    const fetchImpl = vi.fn().mockResolvedValue(json({ title: "Too Many Requests" }, 429, { "x-rate-limit-reset": String(reset) }));
    const { sb } = makeSb(fresh());
    const c = await getXClientForProfile("p-1", sb, { fetchImpl });
    const err = await c.getMe().catch((e) => e);
    expect(err).toBeInstanceOf(XRateLimited);
    expect(err.resetAt.getTime()).toBe(reset * 1000);
  });

  it("createTweet posts the body (and reply target) and tracks cost, $0.200 when the text carries a URL", async () => {
    const fetchImpl = vi.fn(async (_u: string, init: any) => json({ data: { id: "t1", text: JSON.parse(init.body).text } }, 201));
    const { sb } = makeSb(fresh());
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });

    const a = await c.createTweet({ text: "hello world" });
    expect(a).toEqual({ id: "t1", text: "hello world" });
    expect(c.estimatedCostUsd).toBeCloseTo(0.015, 6);

    await c.createTweet({ text: "https://example.com/x", reply: { in_reply_to_tweet_id: "t1" } });
    expect(c.estimatedCostUsd).toBeCloseTo(0.215, 6);

    const [url, init] = fetchImpl.mock.calls[1] as any[];
    expect(url).toBe(`${API}/tweets`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ text: "https://example.com/x", reply: { in_reply_to_tweet_id: "t1" } });
  });

  it("getMe costs a user read; reads of own posts cost $0.001 each, others $0.005", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/users/me")) return json({ data: { id: "999", username: "cisco" } });
      if (url.includes("/users/999/tweets")) return json({ data: [{ id: "1", text: "a" }, { id: "2", text: "b" }], meta: { result_count: 2 } });
      if (url.includes("/users/123/tweets")) return json({ data: [{ id: "3", text: "c" }], meta: { result_count: 1 } });
      if (url.includes("/tweets/search/recent")) return json({ data: [{ id: "4", text: "d" }, { id: "5", text: "e" }], meta: { result_count: 2 } });
      return json({ data: { id: "6", text: "f" } });
    });
    const { sb } = makeSb(fresh());
    const c = await getXClientForProfile("p-1", sb, { fetchImpl: fetchImpl as any });

    await c.getMe();
    expect(c.estimatedCostUsd).toBeCloseTo(0.01, 6);
    await c.getUserTweets("999", { max_results: 5, exclude: ["replies", "retweets"], tweetFields: ["public_metrics"] });
    expect(c.estimatedCostUsd).toBeCloseTo(0.012, 6);
    await c.getUserTweets("123");
    expect(c.estimatedCostUsd).toBeCloseTo(0.017, 6);
    const page = await c.searchRecent({ query: "from:a -is:reply", max_results: 10 });
    expect(page.data).toHaveLength(2);
    expect(c.estimatedCostUsd).toBeCloseTo(0.027, 6);
    await c.getTweet("6");
    expect(c.estimatedCostUsd).toBeCloseTo(0.032, 6);

    const ownUrl = new URL((fetchImpl.mock.calls[1] as any[])[0]);
    expect(ownUrl.searchParams.get("max_results")).toBe("5");
    expect(ownUrl.searchParams.get("exclude")).toBe("replies,retweets");
    expect(ownUrl.searchParams.get("tweet.fields")).toBe("public_metrics");
    const searchUrl = new URL((fetchImpl.mock.calls[3] as any[])[0]);
    expect(searchUrl.searchParams.get("query")).toBe("from:a -is:reply");
  });
});
