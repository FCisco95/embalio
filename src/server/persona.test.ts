import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn().mockResolvedValue({
    data: { voiceSpec: "lowercase, punchy", contentPillars: ["AI", "agents"], seedAccounts: ["@balajis"], samplePosts: ["gm"] },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server");

import { synthesizePersona, savePersona } from "@/server/persona";
import { supabaseServer } from "@/lib/supabase/server";

describe("synthesizePersona", () => {
  it("returns the synthesized persona from the model", async () => {
    const p = await synthesizePersona({ niche: "AI", goals: "grow tech twitter", tone: "punchy" });
    expect(p.voiceSpec).toContain("punchy");
    expect(p.contentPillars).toContain("agents");
    expect(p.seedAccounts).toEqual(["@balajis"]);
  });
});

const BASE_INPUT = {
  voiceSpec: "lowercase, no hype",
  goals: "grow reach",
  contentPillars: ["AI", "agents"],
  answers: { niche: "AI", goals: "grow", tone: "casual" },
  seedAccounts: [] as string[],
};

describe("savePersona — Fix 3: atomic save via RPC with normalized + deduped handles", () => {
  it("calls the save_persona RPC with normalized (lowercase, no leading @) handles", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseServer).mockResolvedValue({ rpc: rpcMock } as any);

    await savePersona("p-1", {
      ...BASE_INPUT,
      seedAccounts: ["@Alice", "@BOB"],
    });

    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith(
      "save_persona",
      expect.objectContaining({
        p_profile_id: "p-1",
        p_seed_handles: expect.arrayContaining(["alice", "bob"]),
      }),
    );
  });

  it("deduplicates handles that normalize to the same value", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseServer).mockResolvedValue({ rpc: rpcMock } as any);

    await savePersona("p-1", {
      ...BASE_INPUT,
      seedAccounts: ["@Alice", "alice", "@ALICE"],
    });

    const args = rpcMock.mock.calls[0][1] as { p_seed_handles: string[] };
    expect(args.p_seed_handles).toHaveLength(1);
    expect(args.p_seed_handles[0]).toBe("alice");
  });

  it("throws when the save_persona RPC returns an error", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: { message: "RPC failed", code: "P0001" } });
    vi.mocked(supabaseServer).mockResolvedValue({ rpc: rpcMock } as any);

    await expect(
      savePersona("p-1", BASE_INPUT),
    ).rejects.toThrow("RPC failed");
  });

  it("passes profile fields to the RPC", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseServer).mockResolvedValue({ rpc: rpcMock } as any);

    await savePersona("p-1", {
      ...BASE_INPUT,
      voiceSpec: "terse",
      goals: "ship fast",
      contentPillars: ["infra", "DX"],
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "save_persona",
      expect.objectContaining({
        p_voice_spec: "terse",
        p_goals: "ship fast",
        p_content_pillars: ["infra", "DX"],
      }),
    );
  });
});
