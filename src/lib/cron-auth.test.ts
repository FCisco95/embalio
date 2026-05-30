import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cronAuthError } from "@/lib/cron-auth";

function reqWith(auth?: string): Request {
  return new Request("https://x/api/cron", auth ? { headers: { authorization: auth } } : {});
}

describe("cronAuthError", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => { process.env.CRON_SECRET = "s3cret-token"; });
  afterEach(() => { process.env.CRON_SECRET = original; });

  it("returns 500 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = cronAuthError(reqWith("Bearer whatever"));
    expect(res?.status).toBe(500);
  });

  it("returns 401 when the bearer token is wrong", () => {
    expect(cronAuthError(reqWith("Bearer wrong"))?.status).toBe(401);
  });

  it("returns 401 when the header is missing", () => {
    expect(cronAuthError(reqWith())?.status).toBe(401);
  });

  it("returns 401 on a length mismatch (no early-exit leak)", () => {
    expect(cronAuthError(reqWith("Bearer s3cret-token-extra"))?.status).toBe(401);
  });

  it("authorizes the correct bearer token (returns null)", () => {
    expect(cronAuthError(reqWith("Bearer s3cret-token"))).toBeNull();
  });
});
