import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const inserted: Array<Record<string, unknown>> = [];
const draftUpdates: Array<Record<string, unknown>> = [];
const candUpdates: Array<Record<string, unknown>> = [];
const candEqs: Array<[string, unknown]> = [];

function makeClient() {
  return {
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
      return { update: (row: Record<string, unknown>) => ({ eq: async (col: string, val: unknown) => { candUpdates.push(row); candEqs.push([col, val]); return { error: null }; } }) };
    },
  } as unknown as SupabaseClient<Database>;
}

// The cores are service-role safe: they must never reach for a session.
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => { throw new Error("supabaseServer used by a core"); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));

import { markRepliedQuickCore, dismissCandidateCore } from "@/server/posts-core";

beforeEach(() => { inserted.length = 0; draftUpdates.length = 0; candUpdates.length = 0; candEqs.length = 0; });

describe("markRepliedQuickCore", () => {
  it("creates a reply draft + URL-less post and flips statuses on the injected client", async () => {
    await markRepliedQuickCore(makeClient(), "p1", { candidateId: "c1", reply: "great point" });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ profile_id: "p1", draft_id: "draft-new", tweet_url: null });
    expect(draftUpdates[0]).toMatchObject({ status: "posted" });
    expect(candUpdates[0]).toMatchObject({ status: "engaged" });
  });

  it("rejects an empty reply and a missing profile", async () => {
    await expect(markRepliedQuickCore(makeClient(), "p1", { candidateId: "c1", reply: "  " })).rejects.toThrow(/empty/i);
    await expect(markRepliedQuickCore(makeClient(), "", { candidateId: "c1", reply: "x" })).rejects.toThrow(/no profile/i);
  });
});

describe("dismissCandidateCore", () => {
  it("dismisses by id on the injected client", async () => {
    await dismissCandidateCore(makeClient(), "c1");
    expect(candUpdates[0]).toMatchObject({ status: "dismissed" });
    expect(candEqs[0]).toEqual(["id", "c1"]);
  });
});
