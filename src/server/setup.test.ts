import { describe, it, expect, vi, beforeEach } from "vitest";

const synthesizePersona = vi.fn();
const savePersona = vi.fn();
const recommendTargets = vi.fn();
const updateEq = vi.fn().mockResolvedValue({ error: null });
const fromUpdate = vi.fn();
const getUser = vi.fn();
// finalizeSetup now calls assertOwnProfile before touching the row, so the
// ownership select has to be mocked alongside the profile update.
const ownershipRow = vi.fn<() => Promise<{ data: { id: string } | null; error: null }>>();

vi.mock("@/server/persona", () => ({
  synthesizePersona: (...a: unknown[]) => synthesizePersona(...a),
  savePersona: (...a: unknown[]) => savePersona(...a),
}));
vi.mock("@/server/target-queue", () => ({ recommendTargets: (...a: unknown[]) => recommendTargets(...a) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: () => getUser() },
    from: (...a: unknown[]) => fromUpdate(...a),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { buildSetupPreview, finalizeSetup } from "@/server/setup";
import { EMPTY_ANSWERS } from "@/lib/setup-steps";

const answers = {
  ...EMPTY_ANSWERS,
  handle: "@fcisco95", accountSize: "<500", premium: true,
  pillars: ["AI agents"], goal: "followers", capacity: "30m",
  voiceMethod: "pull" as const, voiceCorpus: ["my post one", "my post two"],
};

beforeEach(() => {
  synthesizePersona.mockReset();
  savePersona.mockReset();
  recommendTargets.mockReset();
  updateEq.mockClear();
  updateEq.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  ownershipRow.mockResolvedValue({ data: { id: "p-1" }, error: null });
  fromUpdate.mockReset();
  fromUpdate.mockImplementation(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ownershipRow() }) }) }),
    update: () => ({ eq: updateEq }),
  }));
});

describe("buildSetupPreview", () => {
  it("synthesizes the persona and recommends targets from synthesized pillars", async () => {
    synthesizePersona.mockResolvedValueOnce({ voiceSpec: "punchy", contentPillars: ["AI agents", "agents"], seedAccounts: [], samplePosts: [] });
    recommendTargets.mockResolvedValueOnce({ targets: [{ handle: "@a", reason: "r", priority: "high", suggested_approach: "x" }], generatedAt: "now" });

    const out = await buildSetupPreview(answers);
    expect(out.synth.voiceSpec).toBe("punchy");
    expect(out.targets.targets[0].handle).toBe("@a");
    expect(recommendTargets).toHaveBeenCalledWith(
      expect.objectContaining({ contentPillars: ["AI agents", "agents"], northStarMetric: "grow followers" }),
    );
  });

  it("returns empty targets (does not throw) when recommendation fails", async () => {
    synthesizePersona.mockResolvedValueOnce({ voiceSpec: "v", contentPillars: ["AI"], seedAccounts: [], samplePosts: [] });
    recommendTargets.mockRejectedValueOnce(new Error("model down"));
    const out = await buildSetupPreview(answers);
    expect(out.targets.targets).toEqual([]);
  });
});

describe("finalizeSetup", () => {
  it("updates profile basics then saves persona with curated handles", async () => {
    await finalizeSetup("p-1", {
      answers,
      voiceSpec: "punchy",
      contentPillars: ["AI agents"],
      seedHandles: ["alice", "bob"],
    });

    expect(fromUpdate).toHaveBeenCalledWith("profiles");
    expect(updateEq).toHaveBeenCalledWith("id", "p-1");
    expect(savePersona).toHaveBeenCalledWith("p-1", expect.objectContaining({
      voiceSpec: "punchy",
      contentPillars: ["AI agents"],
      seedAccounts: ["alice", "bob"],
      premiumAccount: true,
      northStarMetric: "grow followers",
    }));
  });

  it("refuses to write to a profile the session user does not own", async () => {
    ownershipRow.mockResolvedValue({ data: null, error: null });

    await expect(
      finalizeSetup("p-someone-else", {
        answers,
        voiceSpec: "punchy",
        contentPillars: ["AI agents"],
        seedHandles: [],
      }),
    ).rejects.toThrow(/access denied/i);

    expect(updateEq).not.toHaveBeenCalled();
    expect(savePersona).not.toHaveBeenCalled();
  });
});
