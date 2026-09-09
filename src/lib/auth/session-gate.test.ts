import { describe, it, expect } from "vitest";
import { decideSessionRedirect, hasSupabaseSessionCookie, isProtectedPath } from "@/lib/auth/session-gate";

describe("hasSupabaseSessionCookie", () => {
  it("matches the SSR auth-token cookie, chunked or not", () => {
    expect(hasSupabaseSessionCookie(["sb-vzxpakxjnuaesfxihyvl-auth-token"])).toBe(true);
    expect(hasSupabaseSessionCookie(["theme", "sb-vzxpakxjnuaesfxihyvl-auth-token.1"])).toBe(true);
  });
  it("ignores unrelated and code-verifier cookies", () => {
    expect(hasSupabaseSessionCookie([])).toBe(false);
    expect(hasSupabaseSessionCookie(["theme", "sb-vzxpakxjnuaesfxihyvl-auth-token-code-verifier"])).toBe(false);
  });
});

describe("isProtectedPath", () => {
  it.each(["/", "/setup", "/engage", "/performance/gate-2", "/topics", "/compose", "/plan", "/profiles", "/studio/x", "/board"])(
    "protects %s",
    (p) => expect(isProtectedPath(p)).toBe(true),
  );
  it.each(["/login", "/privacy", "/api/pulse", "/api/nudge", "/api/telegram/poll", "/api/cron/sniper", "/manifest.webmanifest"])(
    "passes %s through",
    (p) => expect(isProtectedPath(p)).toBe(false),
  );
});

describe("decideSessionRedirect", () => {
  it("sends anonymous visitors of protected paths to /login", () => {
    expect(decideSessionRedirect("/", false)).toBe("/login");
    expect(decideSessionRedirect("/performance/gate-2", false)).toBe("/login");
  });
  it("lets verified sessions through", () => {
    expect(decideSessionRedirect("/", true)).toBeNull();
    expect(decideSessionRedirect("/engage", true)).toBeNull();
  });
  it("bounces a verified session off /login", () => {
    expect(decideSessionRedirect("/login", true)).toBe("/");
  });
  it("shows /login to an unverified session — a stale cookie must NOT bounce back to /", () => {
    // Regression guard for the loop: cookie present, refresh token already
    // consumed → layout redirects to /login → cookie-presence check sent it
    // back to / → repeat. The decision must be made on verification.
    expect(decideSessionRedirect("/login", false)).toBeNull();
  });
  it("never redirects public and API paths", () => {
    expect(decideSessionRedirect("/privacy", false)).toBeNull();
    expect(decideSessionRedirect("/api/pulse", false)).toBeNull();
    expect(decideSessionRedirect("/api/cron/sniper", true)).toBeNull();
  });
});
