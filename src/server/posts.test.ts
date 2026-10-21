import { describe, it, expect, vi, beforeEach } from "vitest";

const inserted: Array<Record<string, unknown>> = [];
const draftUpdates: Array<Record<string, unknown>> = [];
const candUpdates: Array<Record<string, unknown>> = [];

const candEqs: Array<[string, unknown]> = [];
const serverCalls = { n: 0 };

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
  };
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => { serverCalls.n++; return makeClient(); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { markRepliedQuick, dismissCandidate } from "@/server/posts";

beforeEach(() => { inserted.length = 0; draftUpdates.length = 0; candUpdates.length = 0; candEqs.length = 0; serverCalls.n = 0; });

describe("markRepliedQuick", () => {

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

// The "use server" wrappers take NO client: they always run on the cookie-bound (RLS) client.
// The injectable cores live in posts-core.ts for no-session callers (see posts-core.test.ts).
describe("server action wrappers", () => {
  it("markRepliedQuick runs on supabaseServer()", async () => {
    await markRepliedQuick("p1", { candidateId: "c1", reply: "great point" });
    expect(serverCalls.n).toBe(1);
    expect(candUpdates[0]).toMatchObject({ status: "engaged" });
  });

  it("dismissCandidate runs on supabaseServer()", async () => {
    await dismissCandidate("c1");
    expect(serverCalls.n).toBe(1);
    expect(candUpdates[0]).toMatchObject({ status: "dismissed" });
    expect(candEqs[0]).toEqual(["id", "c1"]);
  });

  it("neither wrapper accepts a client (a service-role client cannot be smuggled in)", () => {
    expect(markRepliedQuick.length).toBeLessThanOrEqual(2);
    expect(dismissCandidate.length).toBeLessThanOrEqual(1);
  });
});
