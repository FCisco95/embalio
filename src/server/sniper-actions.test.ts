import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The four sniper server actions are public POST endpoints (no auth layer), so
// the only tenant check available is the FIXED_PROFILE_ID match the rest of the
// repo uses. See docs/superpowers/plans/2026-08-02-f2-sniper-action-guards.md —
// this is defense-in-depth, NOT a fix for F2.
vi.mock("@/server/sniper", () => ({
  markSniperAlert: vi.fn(),
  markSniperReplySent: vi.fn(),
  setReplyOutcome: vi.fn(),
  createManualAlert: vi.fn().mockResolvedValue({ ok: true, alertId: "a1", score: 0.7 }),
}));

const OWNER = "7a728122-569a-4db0-8773-1e537fd1a92f";
const INTRUDER = "00000000-0000-0000-0000-000000000000";

describe("sniper actions — tenant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("FIXED_PROFILE_ID", OWNER);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("actOnSniperAlert rejects a foreign profileId without touching the DB", async () => {
    const { markSniperAlert } = await import("@/server/sniper");
    const { actOnSniperAlert } = await import("@/server/sniper-actions");
    await expect(actOnSniperAlert(INTRUDER, "alert-1", "acted")).rejects.toThrow("profile_id mismatch");
    expect(markSniperAlert).not.toHaveBeenCalled();
  });

  it("confirmSentReply rejects a foreign profileId without touching the DB", async () => {
    const { markSniperReplySent } = await import("@/server/sniper");
    const { confirmSentReply } = await import("@/server/sniper-actions");
    await expect(confirmSentReply(INTRUDER, "alert-1", "hi")).rejects.toThrow("profile_id mismatch");
    expect(markSniperReplySent).not.toHaveBeenCalled();
  });

  it("recordReplyOutcome rejects a foreign profileId without touching the DB", async () => {
    const { setReplyOutcome } = await import("@/server/sniper");
    const { recordReplyOutcome } = await import("@/server/sniper-actions");
    await expect(recordReplyOutcome(INTRUDER, "alert-1", { replyImpressions: 999 })).rejects.toThrow(
      "profile_id mismatch",
    );
    expect(setReplyOutcome).not.toHaveBeenCalled();
  });

  it("createManualSniperAlert returns ok:false on a foreign profileId — never throws, never embeds", async () => {
    const { createManualAlert } = await import("@/server/sniper");
    const { createManualSniperAlert } = await import("@/server/sniper-actions");
    // Contract: this action never throws (the /engage form renders `reason`),
    // and the guard must run BEFORE createManualAlert spends embedding tokens.
    await expect(
      createManualSniperAlert(INTRUDER, { url: "https://x.com/a/status/1", tweetText: "hi" }),
    ).resolves.toEqual({ ok: false, reason: "profile_id mismatch" });
    expect(createManualAlert).not.toHaveBeenCalled();
  });

  it("lets the configured owner through to every action", async () => {
    const sniper = await import("@/server/sniper");
    const actions = await import("@/server/sniper-actions");
    await actions.actOnSniperAlert(OWNER, "alert-1", "dismissed", "stale");
    await actions.confirmSentReply(OWNER, "alert-1", "hi");
    await actions.recordReplyOutcome(OWNER, "alert-1", { replyImpressions: 10 });
    await actions.createManualSniperAlert(OWNER, { url: "https://x.com/a/status/1", tweetText: "hi" });
    expect(sniper.markSniperAlert).toHaveBeenCalledWith(OWNER, "alert-1", "dismissed", "stale");
    expect(sniper.markSniperReplySent).toHaveBeenCalledWith(OWNER, "alert-1", "hi");
    expect(sniper.setReplyOutcome).toHaveBeenCalledWith(OWNER, "alert-1", { replyImpressions: 10 });
    expect(sniper.createManualAlert).toHaveBeenCalled();
  });

  it("is a no-op when FIXED_PROFILE_ID is unset (local dev / pre-tenancy)", async () => {
    vi.stubEnv("FIXED_PROFILE_ID", "");
    const { markSniperAlert } = await import("@/server/sniper");
    const { actOnSniperAlert } = await import("@/server/sniper-actions");
    await expect(actOnSniperAlert("any-profile", "alert-1", "acted")).resolves.toBeUndefined();
    expect(markSniperAlert).toHaveBeenCalled();
  });
});
