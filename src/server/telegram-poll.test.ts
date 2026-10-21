import { describe, it, expect, vi, beforeEach } from "vitest";

const markRepliedQuickCore = vi.fn();
const dismissCandidateCore = vi.fn();
const getTelegramUpdates = vi.fn();
const answerCallbackQuery = vi.fn();
vi.mock("@/server/posts-core", () => ({
  markRepliedQuickCore: (...a: unknown[]) => markRepliedQuickCore(...a),
  dismissCandidateCore: (...a: unknown[]) => dismissCandidateCore(...a),
}));
vi.mock("@/lib/telegram", () => ({
  getTelegramUpdates: (...a: unknown[]) => getTelegramUpdates(...a),
  answerCallbackQuery: (...a: unknown[]) => answerCallbackQuery(...a),
}));

const candRow = { data: { status: "surfaced" } as Record<string, unknown> | null };
const draftRows = { data: [{ id: "d1", body: "great reply" }] as Array<Record<string, unknown>> };
const profileRow = { data: { retention: { telegram: { offset: 0 } } } as Record<string, unknown> | null };
const updateSpy = vi.fn();

function makeFrom() {
  return (table: string) => {
    if (table === "candidates") {
      return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve(candRow) }) }) }) };
    }
    if (table === "drafts") {
      return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve(draftRows) }) }) }) }) };
    }
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve(profileRow) }) }),
      update: (vals: unknown) => ({ eq: () => { updateSpy(vals); return Promise.resolve({ error: null }); } }),
    };
  };
}
// Cron has no session: the drain must use the service client, not the cookie-bound one.
const serviceClient = { from: makeFrom() };
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => serviceClient,
  supabaseServer: async () => { throw new Error("supabaseServer used without a session"); },
}));

import { applyCallback, drainTelegramUpdates } from "@/server/telegram-poll";

beforeEach(() => {
  markRepliedQuickCore.mockReset();
  dismissCandidateCore.mockReset();
  getTelegramUpdates.mockReset();
  answerCallbackQuery.mockReset();
  updateSpy.mockReset();
  candRow.data = { status: "surfaced" };
  draftRows.data = [{ id: "d1", body: "great reply" }];
  profileRow.data = { retention: { telegram: { offset: 0 } } };
});

describe("applyCallback", () => {
  it("posted → logs the reply via markRepliedQuick", async () => {
    await applyCallback("p1", { action: "posted", candidateId: "c1" });
    expect(markRepliedQuickCore).toHaveBeenCalledWith(serviceClient, "p1", { draftId: "d1", candidateId: "c1", reply: "great reply" });
  });
  it("skip → dismisses the candidate", async () => {
    await applyCallback("p1", { action: "skip", candidateId: "c1" });
    expect(dismissCandidateCore).toHaveBeenCalledWith(serviceClient, "c1");
  });
  it("is idempotent — already-resolved candidate is a no-op", async () => {
    candRow.data = { status: "engaged" };
    await applyCallback("p1", { action: "posted", candidateId: "c1" });
    expect(markRepliedQuickCore).not.toHaveBeenCalled();
  });
});

describe("drainTelegramUpdates", () => {
  it("applies each callback and advances the offset", async () => {
    getTelegramUpdates.mockResolvedValue({
      callbacks: [{ id: "q1", data: "posted:c1", messageId: 1, chatId: 5 }],
      nextOffset: 43,
    });
    const r = await drainTelegramUpdates("p1");
    expect(r.applied).toBe(1);
    expect(markRepliedQuickCore).toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith("q1", expect.any(String));
    expect(updateSpy).toHaveBeenCalledWith({ retention: { telegram: { offset: 43 } } });
  });
  it("fails safe on a telegram error", async () => {
    getTelegramUpdates.mockRejectedValue(new Error("net down"));
    const r = await drainTelegramUpdates("p1");
    expect(r.applied).toBe(0);
    expect(r.error).toContain("net down");
  });
  it("does not persist the offset when an empty poll leaves it unchanged", async () => {
    getTelegramUpdates.mockResolvedValue({ callbacks: [], nextOffset: 0 });
    const r = await drainTelegramUpdates("p1");
    expect(r.applied).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
