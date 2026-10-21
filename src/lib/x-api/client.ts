import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { bodyHasUrl } from "@/lib/posting/link-rule";
import { decryptSecret, encryptSecret } from "./crypto";
import { type FetchImpl, XOAuthError, refreshTokens, xFetchSignal } from "./oauth";
import {
  X_COST_USD,
  XRateLimited,
  XReauthRequired,
  type XClient,
  type XCreateTweetInput,
  type XCreateTweetResult,
  type XPage,
  type XSearchRecentParams,
  type XTweet,
  type XUser,
  type XUserTweetsParams,
} from "./types";

/**
 * X API v2 client for one Embalio profile (OAuth 2.0 user context).
 *
 * Takes a Supabase client as a parameter (never imports `@/lib/supabase/server`:
 * that pulls `next/headers` and breaks `scripts/*.ts`).
 *
 * Token handling: X rotates the refresh token on every refresh, so rotation is
 * guarded by an optimistic lock on `x_accounts.token_version`. A process that
 * loses the race re-reads and uses the winner's stored pair.
 */

const API_BASE = "https://api.x.com/2";
const REFRESH_SKEW_MS = 5 * 60_000;

/** A non-2xx, non-429 answer from the X API. */
export class XApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "XApiError";
  }
}

interface TokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  version: number;
}

type AccountRow = Database["public"]["Tables"]["x_accounts"]["Row"];

function toState(row: AccountRow): TokenState {
  return {
    accessToken: decryptSecret(row.access_token_enc),
    refreshToken: decryptSecret(row.refresh_token_enc),
    expiresAt: new Date(row.access_expires_at).getTime(),
    version: row.token_version,
  };
}

export async function getXClientForProfile(
  profileId: string,
  sb: SupabaseClient<Database>,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<XClient> {
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;

  async function loadRow(): Promise<AccountRow> {
    const { data, error } = await sb.from("x_accounts").select("*").eq("profile_id", profileId).maybeSingle();
    if (error) throw new Error(`x_accounts read failed: ${error.message}`);
    if (!data) throw new Error(`no X account linked for profile ${profileId}`);
    return data;
  }

  const row = await loadRow();
  if (row.needs_reauth) throw new XReauthRequired(profileId);

  let tokens = toState(row);
  let cost = 0;
  const xUserId = row.x_user_id;

  async function adoptStored(): Promise<void> {
    const stored = await loadRow();
    if (stored.needs_reauth) throw new XReauthRequired(profileId);
    tokens = toState(stored);
  }

  /**
   * Flag the account dead, but only if nobody rotated since we read `version`.
   * A concurrent winner may have committed between our re-read and this write;
   * an unguarded flag would then brand a working pair needs_reauth. If the guard
   * loses, adopt the stored pair and return (the caller carries on with it).
   */
  async function markReauth(version: number, message: string): Promise<void> {
    const { data, error } = await sb
      .from("x_accounts")
      .update({ needs_reauth: true, last_error: message, updated_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .eq("token_version", version)
      .select("profile_id");
    if (error) throw new Error(`x_accounts reauth write failed: ${error.message}`);
    if (!data || data.length === 0) {
      await adoptStored();
      return;
    }
    throw new XReauthRequired(profileId);
  }

  /** Refresh + persist the rotated pair behind the token_version guard. */
  async function rotate(): Promise<void> {
    const startedAt = tokens;
    let fresh;
    try {
      fresh = await refreshTokens(startedAt.refreshToken, fetchImpl);
    } catch (e) {
      if (e instanceof XOAuthError && (e.error === "invalid_grant" || e.status === 400)) {
        // The single-use refresh token may be dead because another process rotated first.
        const stored = await loadRow();
        if (stored.token_version !== startedAt.version) {
          await adoptStored();
          return;
        }
        await markReauth(startedAt.version, `${e.error}: refresh token rejected by X`);
        return;
      }
      throw e;
    }

    const now = Date.now();
    const { data, error } = await sb
      .from("x_accounts")
      .update({
        access_token_enc: encryptSecret(fresh.access_token),
        refresh_token_enc: encryptSecret(fresh.refresh_token),
        access_expires_at: new Date(now + fresh.expires_in * 1000).toISOString(),
        token_version: startedAt.version + 1,
        last_refresh_at: new Date(now).toISOString(),
        needs_reauth: false,
        last_error: null,
        updated_at: new Date(now).toISOString(),
      })
      .eq("profile_id", profileId)
      .eq("token_version", startedAt.version)
      .select("profile_id");
    if (error) throw new Error(`x_accounts rotation write failed: ${error.message}`);
    if (!data || data.length === 0) {
      // Lost the race: another process rotated first. Use its stored pair.
      await adoptStored();
      return;
    }
    tokens = {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresAt: now + fresh.expires_in * 1000,
      version: startedAt.version + 1,
    };
  }

  async function request<T>(method: "GET" | "POST", path: string, init: { query?: URLSearchParams; body?: unknown } = {}): Promise<T> {
    if (tokens.expiresAt < Date.now() + REFRESH_SKEW_MS) await rotate();

    const url = `${API_BASE}${path}${init.query && [...init.query].length ? `?${init.query}` : ""}`;
    const send = () =>
      fetchImpl(url, {
        method,
        signal: xFetchSignal(),
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });

    let res = await send();
    if (res.status === 401) {
      await rotate();
      res = await send(); // one retry only
    }
    if (res.status === 429) {
      const reset = Number(res.headers.get("x-rate-limit-reset"));
      throw new XRateLimited(new Date(Number.isFinite(reset) && reset > 0 ? reset * 1000 : Date.now() + 15 * 60_000));
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new XApiError(res.status, `X API ${res.status} ${method} ${path}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  const csv = (v?: string[]) => (v && v.length ? v.join(",") : undefined);
  const params = (entries: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(entries)) if (v !== undefined && v !== "") q.set(k, String(v));
    return q;
  };

  const postReadCost = (userId: string | undefined, n: number) =>
    n * (userId !== undefined && userId === xUserId ? X_COST_USD.ownPostRead : X_COST_USD.postRead);

  const client: XClient = {
    profileId,
    xUserId,
    username: row.x_username,
    get estimatedCostUsd() {
      return cost;
    },

    async createTweet(input: XCreateTweetInput): Promise<XCreateTweetResult> {
      const json = await request<{ data: XCreateTweetResult }>("POST", "/tweets", { body: input });
      cost += bodyHasUrl(input.text) ? X_COST_USD.postCreateWithUrl : X_COST_USD.postCreate;
      return { id: json.data.id, text: json.data.text };
    },

    async getMe(o) {
      const json = await request<{ data: XUser }>("GET", "/users/me", {
        query: params({ "user.fields": csv(o?.userFields) }),
      });
      cost += X_COST_USD.userRead;
      return json.data;
    },

    async getUserTweets(userId: string, p: XUserTweetsParams = {}): Promise<XPage<XTweet>> {
      const json = await request<Partial<XPage<XTweet>>>("GET", `/users/${encodeURIComponent(userId)}/tweets`, {
        query: params({
          start_time: p.start_time,
          since_id: p.since_id,
          max_results: p.max_results,
          exclude: csv(p.exclude),
          pagination_token: p.pagination_token,
          "tweet.fields": csv(p.tweetFields),
        }),
      });
      const data = json.data ?? [];
      cost += postReadCost(userId, data.length);
      return { data, includes: json.includes, meta: json.meta };
    },

    async searchRecent(p: XSearchRecentParams): Promise<XPage<XTweet>> {
      const json = await request<Partial<XPage<XTweet>>>("GET", "/tweets/search/recent", {
        query: params({
          query: p.query,
          since_id: p.since_id,
          start_time: p.start_time,
          max_results: p.max_results,
          next_token: p.next_token,
          "tweet.fields": csv(p.tweetFields),
          expansions: csv(p.expansions),
          "user.fields": csv(p.userFields),
        }),
      });
      const data = json.data ?? [];
      cost += data.length * X_COST_USD.postRead;
      return { data, includes: json.includes, meta: json.meta };
    },

    async getTweet(id: string, o): Promise<XTweet> {
      const json = await request<{ data: XTweet }>("GET", `/tweets/${encodeURIComponent(id)}`, {
        query: params({ "tweet.fields": csv(o?.tweetFields) }),
      });
      cost += postReadCost(json.data.author_id, 1);
      return json.data;
    },
  };
  return client;
}
