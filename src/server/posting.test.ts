import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/posting/x-poster");
vi.mock("@/lib/posting/outcome");

import { postDraft } from "@/server/posting";
import { supabaseServer } from "@/lib/supabase/server";
import { postTweetViaAdsPower } from "@/lib/posting/x-poster";
import { isConfirmedTweetUrl } from "@/lib/posting/outcome";

const mockPostTweet = vi.mocked(postTweetViaAdsPower);
const mockIsConfirmed = vi.mocked(isConfirmedTweetUrl);

const DRAFT = { id: "draft-1", profile_id: "p-1", body: "hello", status: "approved", candidate_id: null };
const ACCOUNT = { id: "acc-1", profile_id: "p-1", adspower_user_id: "aps-1", active: true };
const JOB = { id: "job-1", profile_id: "p-1", draft_id: "draft-1", status: "running" };
const CONFIRMED_URL = "https://x.com/cisco/status/123456";
const UNCONFIRMED_URL = "https://x.com/compose/post";

// A node that is thennable and also supports chainable .select()/.eq()
function node(result: any): any {
  const n: any = {
    then: (res: any, rej: any) => Promise.resolve(result).then(res, rej),
    catch: (rej: any) => Promise.resolve(result).catch(rej),
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  };
  n.select = () => n;
  n.eq = () => n;
  return n;
}

// Builds a mock Supabase client for postDraft.
// from("table") is called in this order across both code paths:
//   drafts(1)=select  posting_accounts(1)=select  posting_jobs(1)=insert
//   [confirmed path]: posts(1)=insert  drafts(2)=update  [candidates(1)=update]  posting_jobs(2)=update
//   [unconfirmed path]: posting_jobs(2)=update
function buildSb({
  draftRow = DRAFT as any,
  accountRow = ACCOUNT as any,
  jobInsertError = null as any,
  postInsertError = null as any,
  draftUpdateError = null as any,
  jobUpdateSpy = vi.fn(),
} = {}) {
  const counts: Record<string, number> = {};

  return {
    from: vi.fn((table: string) => {
      counts[table] = (counts[table] ?? 0) + 1;
      const n = counts[table];

      if (table === "drafts" && n === 1) return node({ data: draftRow, error: null });
      if (table === "drafts" && n >= 2) {
        // update({status:"posted"}).eq(...)
        return { update: (_: any) => node({ error: draftUpdateError }) };
      }

      if (table === "posting_accounts") return node({ data: accountRow, error: null });

      if (table === "posting_jobs" && n === 1) {
        // insert({...}).select().single()
        return { insert: (_: any) => node({ data: JOB, error: jobInsertError }) };
      }
      if (table === "posting_jobs" && n >= 2) {
        // update({status:...}).eq(...)
        return {
          update: (values: any) => {
            jobUpdateSpy(values);
            return node({ error: null });
          },
        };
      }

      if (table === "posts") return { insert: (_: any) => node({ error: postInsertError }) };
      if (table === "candidates") return { update: (_: any) => node({ error: null }) };

      return node({ data: null, error: null });
    }),
  };
}

describe("postDraft — Fix 1: follow-up DB writes must be checked for errors", () => {
  beforeEach(() => {
    mockPostTweet.mockResolvedValue({ url: CONFIRMED_URL });
    mockIsConfirmed.mockReturnValue(true);
  });

  it("throws when drafts.update({status:'posted'}) returns a DB error", async () => {
    const sb = buildSb({ draftUpdateError: { message: "draft update failed", code: "500" } });
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);

    await expect(postDraft("draft-1")).rejects.toThrow("draft update failed");
  });

  it("throws when posting_jobs.update({status:'succeeded'}) returns a DB error", async () => {
    const jobUpdateSpy = vi.fn();
    // draftUpdateError is null so drafts.update succeeds, but we'll make jobUpdate return an error
    const sb = buildSb({
      jobUpdateSpy: vi.fn().mockImplementation((values: any) => {
        jobUpdateSpy(values);
        // We can't return an error from here because buildSb always returns node({error:null})
        // We need a different approach for this particular test case
      }),
    });
    // Use a custom mock that makes posting_jobs.update return an error
    const counts: Record<string, number> = {};
    const customSb = {
      from: vi.fn((table: string) => {
        counts[table] = (counts[table] ?? 0) + 1;
        const n = counts[table];

        if (table === "drafts" && n === 1) return node({ data: DRAFT, error: null });
        if (table === "drafts" && n >= 2) return { update: (_: any) => node({ error: null }) };
        if (table === "posting_accounts") return node({ data: ACCOUNT, error: null });
        if (table === "posting_jobs" && n === 1) return { insert: (_: any) => node({ data: JOB, error: null }) };
        if (table === "posting_jobs" && n >= 2) {
          return { update: (_: any) => node({ error: { message: "job update failed", code: "500" } }) };
        }
        if (table === "posts") return { insert: (_: any) => node({ error: null }) };
        if (table === "candidates") return { update: (_: any) => node({ error: null }) };
        return node({ data: null, error: null });
      }),
    };
    vi.mocked(supabaseServer).mockResolvedValue(customSb as any);

    await expect(postDraft("draft-1")).rejects.toThrow("job update failed");
  });

  it("returns {ok:true, url} when all writes succeed", async () => {
    const sb = buildSb();
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);

    const result = await postDraft("draft-1");
    expect(result).toEqual({ ok: true, url: CONFIRMED_URL });
  });
});

describe("postDraft — Fix 2: unconfirmed URL sets needs_manual_confirmation (not failed)", () => {
  beforeEach(() => {
    mockPostTweet.mockResolvedValue({ url: UNCONFIRMED_URL });
    mockIsConfirmed.mockReturnValue(false);
  });

  it("updates posting_job with status needs_manual_confirmation when URL cannot be confirmed", async () => {
    const jobUpdateSpy = vi.fn();
    const sb = buildSb({ jobUpdateSpy });
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);

    const result = await postDraft("draft-1");

    expect(jobUpdateSpy).toHaveBeenCalledOnce();
    expect(jobUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "needs_manual_confirmation" }),
    );
    expect(result).toEqual(
      expect.objectContaining({ ok: false, error: expect.any(String) }),
    );
  });

  it("does NOT set job status to failed for unconfirmed URL", async () => {
    const jobUpdateSpy = vi.fn();
    const sb = buildSb({ jobUpdateSpy });
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);

    await postDraft("draft-1");

    const updateArg = jobUpdateSpy.mock.calls[0]?.[0];
    expect(updateArg?.status).not.toBe("failed");
  });
});
