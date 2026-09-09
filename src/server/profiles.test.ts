import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function makeUpdateSb(error: null | { message: string } = null) {
  return {
    from: () => ({
      update: () => ({
        eq: () => ({ error }),
      }),
    }),
  };
}

describe("toggleProfileOptimized", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it("updates bio_optimized to true", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const updateSpy = vi.fn().mockReturnValue({ eq: () => ({ error: null }) });
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({ update: updateSpy }),
    });
    const { toggleProfileOptimized } = await import("@/server/profiles");
    await expect(toggleProfileOptimized("p1", "bio_optimized", true)).resolves.toBeUndefined();
    expect(updateSpy).toHaveBeenCalledWith({ bio_optimized: true });
  });

  it("updates pinned_optimized to false", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const updateSpy = vi.fn().mockReturnValue({ eq: () => ({ error: null }) });
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({ update: updateSpy }),
    });
    const { toggleProfileOptimized } = await import("@/server/profiles");
    await expect(toggleProfileOptimized("p1", "pinned_optimized", false)).resolves.toBeUndefined();
    expect(updateSpy).toHaveBeenCalledWith({ pinned_optimized: false });
  });

  it("throws on invalid field name", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(makeUpdateSb());
    const { toggleProfileOptimized } = await import("@/server/profiles");
    // @ts-expect-error intentional invalid field
    await expect(toggleProfileOptimized("p1", "voice_notes", true)).rejects.toThrow("invalid field");
  });

  it("throws when DB update fails", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUpdateSb({ message: "update failed" })
    );
    const { toggleProfileOptimized } = await import("@/server/profiles");
    await expect(toggleProfileOptimized("p1", "bio_optimized", true)).rejects.toThrow("update failed");
  });

  it("revalidates / on success", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(makeUpdateSb());
    const { toggleProfileOptimized } = await import("@/server/profiles");
    const { revalidatePath } = await import("next/cache");
    await toggleProfileOptimized("p1", "bio_optimized", true);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
