import { describe, it, expect, vi, beforeEach } from "vitest";

const inserted: Array<Record<string, unknown>> = [];
const draftUpdates: Array<Record<string, unknown>> = [];
const candUpdates: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (table: string) => {
      if (table === "drafts") {
        return {
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "draft-new" }, error: null }) }),
          }),
          update: (row: Record<string, unknown>) => ({ eq: async () => { draftUpdates.push(row); return { error: null }; } }),
        };
      }
      if (table === "posts") {
        return { insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error: null }; } };
      }
      // candidates
      return { update: (row: Record<string, unknown>) => ({ eq: async () => { candUpdates.push(row); return { error: null }; } }) };
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { markRepliedQuick } from "@/server/posts";

describe("markRepliedQuick", () => {
  beforeEach(() => { inserted.length = 0; draftUpdates.length = 0; candUpdates.length = 0; });

  it("creates a reply draft + URL-less post and flips statuses", async () => {
    await markRepliedQuick("p1", { candidateId: "c1", reply: "great point — here's why" });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ profile_id: "p1", draft_id: "draft-new", tweet_url: null });
    expect(draftUpdates[0]).toMatchObject({ status: "posted" });
    expect(candUpdates[0]).toMatchObject({ status: "engaged" });
  });

  it("rejects an empty reply", async () => {
    await expect(markRepliedQuick("p1", { candidateId: "c1", reply: "  " })).rejects.toThrow(/empty/i);
  });
});
