import { describe, it, expect } from "vitest";
import { checkCaps, hasLink, similarity, type SentAction } from "@/lib/engagement/caps";

const HOUR = 3_600_000;
const mk = (over: Partial<SentAction> = {}): SentAction =>
  ({ authorHandle: "x", sentAt: 0, replyText: "y", ...over });

describe("hasLink", () => {
  it("flags http/https and bare-domain links", () => {
    expect(hasLink("see https://a.com")).toBe(true);
    expect(hasLink("visit a.com/b")).toBe(true);
    expect(hasLink("no links here")).toBe(false);
  });
});

describe("similarity", () => {
  it("is 1 for identical and ~0 for disjoint word sets", () => {
    expect(similarity("alpha beta gamma", "alpha beta gamma")).toBe(1);
    expect(similarity("alpha beta", "delta epsilon")).toBe(0);
  });
});

describe("checkCaps", () => {
  const now = 100 * HOUR;
  it("passes a clean draft with no recent sends", () => {
    expect(checkCaps({ now, draft: "a specific point", targetHandle: "alice", recent: [] }))
      .toEqual({ ok: true, blocks: [] });
  });
  it("blocks links", () => {
    const v = checkCaps({ now, draft: "check my site.com", targetHandle: "a", recent: [] });
    expect(v.ok).toBe(false);
    expect(v.blocks).toContain("link");
  });
  // Cap semantics (owner decision 2026-06-23): block when priors >= cap, i.e. <=3 per
  // account/day are allowed and the 4th is blocked. Three prior same-account sends in
  // the window => the 4th is refused.
  it("blocks a 4th reply to the same account in 24h (<=3/account/day cap)", () => {
    const recent = [
      mk({ authorHandle: "alice", sentAt: now - HOUR }),
      mk({ authorHandle: "alice", sentAt: now - 2 * HOUR }),
      mk({ authorHandle: "alice", sentAt: now - 3 * HOUR }),
    ];
    expect(checkCaps({ now, draft: "new", targetHandle: "alice", recent }).blocks).toContain("per_account");
  });
  it("does NOT count same-account sends older than 24h", () => {
    const recent = [
      mk({ authorHandle: "alice", sentAt: now - 25 * HOUR }),
      mk({ authorHandle: "alice", sentAt: now - 26 * HOUR }),
      mk({ authorHandle: "alice", sentAt: now - 27 * HOUR }),
    ];
    expect(checkCaps({ now, draft: "new", targetHandle: "alice", recent }).ok).toBe(true);
  });
  it("blocks at 20 sends in the last hour", () => {
    const recent = Array.from({ length: 20 }, (_, i) => mk({ authorHandle: `h${i}`, sentAt: now - 1000 * i }));
    expect(checkCaps({ now, draft: "new", targetHandle: "z", recent }).blocks).toContain("hourly");
  });
  it("blocks at 50 sends in the last 24h", () => {
    const recent = Array.from({ length: 50 }, (_, i) => mk({ authorHandle: `h${i}`, sentAt: now - HOUR - 1000 * i }));
    expect(checkCaps({ now, draft: "new", targetHandle: "z", recent }).blocks).toContain("daily");
  });
  it("blocks a near-identical reply", () => {
    const recent = [mk({ replyText: "latency is the silent killer in agents", sentAt: now - HOUR })];
    const v = checkCaps({ now, draft: "latency is the silent killer in agents today", targetHandle: "z", recent });
    expect(v.blocks).toContain("near_duplicate");
  });
});
