import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));
vi.mock("@/server/auth", () => ({ assertOwnProfile: vi.fn() }));

import { disconnectXAccount, getXAccountStatus } from "@/server/x-accounts";
import { supabaseService } from "@/lib/supabase/server";
import { assertOwnProfile } from "@/server/auth";
import { encryptSecret } from "@/lib/x-api/crypto";
import { revalidatePath } from "next/cache";

function buildSb(row: any) {
  const calls: Array<[string, ...unknown[]]> = [];
  const q: any = {
    select: (...a: unknown[]) => (calls.push(["select", ...a]), q),
    eq: (...a: unknown[]) => (calls.push(["eq", ...a]), q),
    delete: () => (calls.push(["delete"]), q),
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    then: (res: any, rej: any) => Promise.resolve({ error: null }).then(res, rej),
  };
  const sb = { from: vi.fn(() => q) };
  vi.mocked(supabaseService).mockReturnValue(sb as any);
  return { sb, calls };
}

describe("x-accounts actions", () => {
  const saved = { k: process.env.X_TOKEN_ENC_KEY, i: process.env.X_CLIENT_ID, s: process.env.X_CLIENT_SECRET };
  beforeEach(() => {
    process.env.X_TOKEN_ENC_KEY = randomBytes(32).toString("base64");
    process.env.X_CLIENT_ID = "cid";
    process.env.X_CLIENT_SECRET = "csecret";
    vi.mocked(assertOwnProfile).mockReset().mockResolvedValue(undefined);
    vi.mocked(revalidatePath).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of [["X_TOKEN_ENC_KEY", saved.k], ["X_CLIENT_ID", saved.i], ["X_CLIENT_SECRET", saved.s]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  describe("getXAccountStatus", () => {
    it("returns non-secret columns only, after the ownership check", async () => {
      const { calls } = buildSb({ x_username: "cisco", needs_reauth: false, last_refresh_at: "2026-10-21T10:00:00Z", last_error: null });
      const out = await getXAccountStatus("p-1");
      expect(assertOwnProfile).toHaveBeenCalledWith("p-1");
      expect(out).toEqual({ username: "cisco", needsReauth: false, lastRefreshAt: "2026-10-21T10:00:00Z", lastError: null });
      const select = calls.find((c) => c[0] === "select")![1] as string;
      expect(select).not.toMatch(/token/);
    });

    it("null when nothing is linked", async () => {
      buildSb(null);
      expect(await getXAccountStatus("p-1")).toBeNull();
    });

    it("rejects a profile the caller does not own", async () => {
      vi.mocked(assertOwnProfile).mockRejectedValue(new Error("Profile not found or access denied"));
      const { sb } = buildSb(null);
      await expect(getXAccountStatus("p-2")).rejects.toThrow(/access denied/);
      expect(sb.from).not.toHaveBeenCalled();
    });
  });

  describe("disconnectXAccount", () => {
    it("revokes the refresh token at X, deletes the row and revalidates /profiles", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const { calls } = buildSb({ access_token_enc: encryptSecret("at"), refresh_token_enc: encryptSecret("rt") });

      expect(await disconnectXAccount("p-1")).toEqual({ ok: true });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.x.com/2/oauth2/revoke");
      expect(init.method).toBe("POST");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("cid:csecret").toString("base64")}`);
      const body = new URLSearchParams(init.body as string);
      expect(body.get("token")).toBe("rt");
      expect(body.get("token_type_hint")).toBe("refresh_token");
      expect(calls).toContainEqual(["delete"]);
      expect(calls).toContainEqual(["eq", "profile_id", "p-1"]);
      expect(revalidatePath).toHaveBeenCalledWith("/profiles");
    });

    it("still deletes the row when the revoke call fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
      const { calls } = buildSb({ access_token_enc: encryptSecret("at"), refresh_token_enc: encryptSecret("rt") });
      expect(await disconnectXAccount("p-1")).toEqual({ ok: true });
      expect(calls).toContainEqual(["delete"]);
    });

    it("still deletes the row when the stored token cannot be decrypted", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { calls } = buildSb({ access_token_enc: "v1.bad.bad.bad", refresh_token_enc: "v1.bad.bad.bad" });
      expect(await disconnectXAccount("p-1")).toEqual({ ok: true });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(calls).toContainEqual(["delete"]);
    });

    it("is a no-op success when nothing is linked", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      buildSb(null);
      expect(await disconnectXAccount("p-1")).toEqual({ ok: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a profile the caller does not own and touches nothing", async () => {
      vi.mocked(assertOwnProfile).mockRejectedValue(new Error("Profile not found or access denied"));
      const { sb } = buildSb(null);
      await expect(disconnectXAccount("p-2")).rejects.toThrow(/access denied/);
      expect(sb.from).not.toHaveBeenCalled();
    });
  });
});
