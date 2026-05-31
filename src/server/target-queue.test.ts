import { describe, it, expect, vi } from "vitest";

const generateStructured = vi.fn();
vi.mock("@/lib/generate", () => ({ generateStructured: (...a: unknown[]) => generateStructured(...a) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));

import { recommendTargets } from "@/server/target-queue";

describe("recommendTargets", () => {
  it("returns the model's target queue", async () => {
    generateStructured.mockResolvedValueOnce({
      data: { targets: [{ handle: "@a", reason: "r", priority: "high", suggested_approach: "x" }], generatedAt: "now" },
    });
    const q = await recommendTargets({ existingHandles: [], contentPillars: ["AI"], northStarMetric: "grow", date: "May 31, 2026" });
    expect(q.targets[0].handle).toBe("@a");
    expect(generateStructured).toHaveBeenCalledOnce();
  });

  it("throws when the model returns no data", async () => {
    generateStructured.mockResolvedValueOnce({ data: null });
    await expect(
      recommendTargets({ existingHandles: [], contentPillars: ["AI"], northStarMetric: null, date: "May 31, 2026" }),
    ).rejects.toThrow(/target queue/);
  });
});
