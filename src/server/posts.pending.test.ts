import { describe, it, expect, vi } from "vitest";

const calls: Array<[string, ...unknown[]]> = [];

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => {
    const q: any = {
      select: (...a: unknown[]) => (calls.push(["select", ...a]), q),
      eq: (...a: unknown[]) => (calls.push(["eq", ...a]), q),
      in: (...a: unknown[]) => (calls.push(["in", ...a]), q),
      order: (...a: unknown[]) => (calls.push(["order", ...a]), Promise.resolve({ data: [{ id: "d1" }], error: null })),
    };
    return { from: () => q };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { listPendingDrafts } from "@/server/posts";

describe("listPendingDrafts", () => {
  it("includes scheduled drafts and selects the revamp columns", async () => {
    calls.length = 0;
    const rows = await listPendingDrafts("p1");
    expect(rows).toEqual([{ id: "d1" }]);

    expect(calls).toContainEqual(["in", "status", ["draft", "approved", "scheduled"]]);
    const select = calls.find((c) => c[0] === "select")![1] as string;
    for (const col of ["scheduled_at", "angle", "rationale", "link_url", "body", "kind", "suggested_visual", "status", "created_at"]) {
      expect(select).toContain(col);
    }
  });
});
