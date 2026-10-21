import { describe, it, expect, vi, beforeEach } from "vitest";

// The four sniper server actions are public POST endpoints, so each one must
// prove the caller owns the profile (assertOwnProfile: session user + RLS-scoped
// lookup) before it writes to the dataset GATE-2 is judged on.
const assertOwnProfile = vi.fn();
vi.mock("@/server/auth", () => ({ assertOwnProfile: (id: string) => assertOwnProfile(id) }));
vi.mock("@/server/sniper", () => ({
  markSniperAlert: vi.fn(),
  markSniperReplySent: vi.fn(),
  setReplyOutcome: vi.fn(),
  createManualAlert: vi.fn().mockResolvedValue({ ok: true, alertId: "a1", score: 0.7 }),
}));

const OWNER = "7a728122-569a-4db0-8773-1e537fd1a92f";
const INTRUDER = "00000000-0000-0000-0000-000000000000";
const DENIED = "Profile not found or access denied";

describe("sniper actions — tenant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    assertOwnProfile.mockImplementation(async (id: string) => {
      if (id !== OWNER) throw new Error(DENIED);
    });
  });

  it("actOnSniperAlert rejects a foreign profileId without touching the DB", async () => {
    const { markSniperAlert } = await import("@/server/sniper");
    const { actOnSniperAlert } = await import("@/server/sniper-actions");
    await expect(actOnSniperAlert(INTRUDER, "alert-1", "acted")).rejects.toThrow(DENIED);
    expect(markSniperAlert).not.toHaveBeenCalled();
  });

  it("confirmSentReply rejects a foreign profileId without touching the DB", async () => {
    const { markSniperReplySent } = await import("@/server/sniper");
    const { confirmSentReply } = await import("@/server/sniper-actions");
    await expect(confirmSentReply(INTRUDER, "alert-1", "hi")).rejects.toThrow(DENIED);
    expect(markSniperReplySent).not.toHaveBeenCalled();
  });

  it("recordReplyOutcome rejects a foreign profileId without touching the DB", async () => {
    const { setReplyOutcome } = await import("@/server/sniper");
    const { recordReplyOutcome } = await import("@/server/sniper-actions");
    await expect(recordReplyOutcome(INTRUDER, "alert-1", { replyImpressions: 999 })).rejects.toThrow(DENIED);
    expect(setReplyOutcome).not.toHaveBeenCalled();
  });

  it("createManualSniperAlert returns ok:false on a foreign profileId — never throws, never embeds", async () => {
    const { createManualAlert } = await import("@/server/sniper");
    const { createManualSniperAlert } = await import("@/server/sniper-actions");
    // Contract: this action never throws (the /engage form renders `reason`),
    // and the guard must run BEFORE createManualAlert spends embedding tokens.
    await expect(
      createManualSniperAlert(INTRUDER, { url: "https://x.com/a/status/1", tweetText: "hi" }),
    ).resolves.toEqual({ ok: false, reason: "profile not found or access denied" });
    expect(createManualAlert).not.toHaveBeenCalled();
  });

  it("lets the owner through to every action, checking ownership of the profile each time", async () => {
    const sniper = await import("@/server/sniper");
    const actions = await import("@/server/sniper-actions");
    await actions.actOnSniperAlert(OWNER, "alert-1", "dismissed", "stale");
    await actions.confirmSentReply(OWNER, "alert-1", "hi");
    await actions.recordReplyOutcome(OWNER, "alert-1", { replyImpressions: 10 });
    await actions.createManualSniperAlert(OWNER, { url: "https://x.com/a/status/1", tweetText: "hi" });
    expect(assertOwnProfile).toHaveBeenCalledTimes(4);
    expect(assertOwnProfile).toHaveBeenCalledWith(OWNER);
    expect(sniper.markSniperAlert).toHaveBeenCalledWith(OWNER, "alert-1", "dismissed", "stale");
    expect(sniper.markSniperReplySent).toHaveBeenCalledWith(OWNER, "alert-1", "hi");
    expect(sniper.setReplyOutcome).toHaveBeenCalledWith(OWNER, "alert-1", { replyImpressions: 10 });
    expect(sniper.createManualAlert).toHaveBeenCalled();
  });
});
