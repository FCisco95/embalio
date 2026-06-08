import { describe, it, expect, vi, beforeEach } from "vitest";

const generateStructured = vi.fn();
vi.mock("@/lib/generate", () => ({ generateStructured: (...a: unknown[]) => generateStructured(...a) }));

import { gateTrend } from "@/lib/credibility/gate";
import type { Trend } from "@/lib/schemas";

const trend: Trend = { topic: "t", why_now: "w", angle: "a" };

describe("gateTrend", () => {
  beforeEach(() => generateStructured.mockReset());

  it("returns the model verdict when generation succeeds", async () => {
    generateStructured.mockResolvedValue({ data: { keep: true, angle: "my take", reason: "on niche" } });
    const v = await gateTrend(["pillar"], "niche", trend);
    expect(v).toEqual({ keep: true, angle: "my take", reason: "on niche" });
  });

  it("fails safe to keep=false when generation returns no data", async () => {
    generateStructured.mockResolvedValue({ data: null, raw: "garbage" });
    const v = await gateTrend(["pillar"], "niche", trend);
    expect(v.keep).toBe(false);
    expect(v.reason).toMatch(/gate/i);
  });
});
