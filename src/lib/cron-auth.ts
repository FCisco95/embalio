import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

// Constant-time comparison so the bearer secret can't be recovered byte-by-byte
// via response-timing. Length mismatch short-circuits to false (lengths aren't
// secret), and equal-length inputs are compared without early-exit.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Gate a cron route on the shared bearer secret. Returns a NextResponse to
 * return immediately when auth fails (or CRON_SECRET is unset), or null when the
 * caller is authorized and the handler may proceed.
 */
export function cronAuthError(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const header = req.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}
