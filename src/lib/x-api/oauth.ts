import { createHash, randomBytes } from "node:crypto";

/** X OAuth 2.0 (Authorization Code + PKCE, user context). Pure helpers: no Supabase, no Next. */

export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"] as const;
export const X_OAUTH_COOKIE = "x_oauth";

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export type FetchImpl = typeof fetch;

/** A non-2xx answer from the token endpoint. `error` is the OAuth error code (e.g. `invalid_grant`). */
export class XOAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: string,
    description?: string,
  ) {
    super(`X token endpoint ${status}: ${error}${description ? ` (${description})` : ""}`);
    this.name = "XOAuthError";
  }
}

export function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildXAuthUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("scope", X_SCOPES.join(" "));
  u.searchParams.set("state", args.state);
  u.searchParams.set("code_challenge", args.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

function credentials(): { clientId: string; basic: string } {
  const clientId = process.env.X_CLIENT_ID;
  const secret = process.env.X_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("X_CLIENT_ID / X_CLIENT_SECRET are not set");
  return { clientId, basic: Buffer.from(`${clientId}:${secret}`).toString("base64") };
}

async function postToken(form: Record<string, string>, fetchImpl: FetchImpl): Promise<TokenSet> {
  const { clientId, basic } = credentials();
  const res = await fetchImpl(X_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...form, client_id: clientId }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenSet> & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) throw new XOAuthError(res.status, json.error ?? "unknown_error", json.error_description);
  if (!json.access_token) throw new Error("X token response missing access_token");
  if (!json.refresh_token) throw new Error("X token response missing refresh_token (is offline.access granted?)");
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in ?? 7200,
    scope: json.scope ?? "",
  };
}

export function exchangeCode(
  args: { code: string; verifier: string; redirectUri: string },
  fetchImpl: FetchImpl = fetch,
): Promise<TokenSet> {
  return postToken(
    {
      grant_type: "authorization_code",
      code: args.code,
      code_verifier: args.verifier,
      redirect_uri: args.redirectUri,
    },
    fetchImpl,
  );
}

/**
 * `GET /2/users/me` with a raw access token (user read, $0.010). Used once at link
 * time, before any `x_accounts` row exists for `getXClientForProfile` to load.
 */
export async function fetchMe(accessToken: string, fetchImpl: FetchImpl = fetch): Promise<{ id: string; username: string }> {
  const res = await fetchImpl("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`X users/me failed: ${res.status}`);
  const json = (await res.json()) as { data?: { id?: string; username?: string } };
  if (!json.data?.id || !json.data.username) throw new Error("X users/me response missing id/username");
  return { id: json.data.id, username: json.data.username };
}

export function refreshTokens(refreshToken: string, fetchImpl: FetchImpl = fetch): Promise<TokenSet> {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);
}
