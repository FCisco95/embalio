import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/x-api/client", () => ({ getXClientForProfile: vi.fn() }));

import { publishDraft } from "@/server/publish";
import { logActivity } from "@/lib/activity";

const DRAFT = {
  id: "draft-1",
  profile_id: "p-1",
  kind: "original",
  body: "a plain post",
  status: "approved",
  candidate_id: null as string | null,
  link_url: null as string | null,
};
const JOB = { id: "job-1" };

// Thennable + chainable node (same idea as posting.test.ts).
function node(result: any): any {
  const n: any = {
    then: (res: any, rej: any) => Promise.resolve(result).then(res, rej),
    catch: (rej: any) => Promise.resolve(result).catch(rej),
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  };
  for (const m of ["select", "eq", "in", "order", "limit"]) n[m] = () => n;
  return n;
}

function buildSb({
  draft = DRAFT as any,
  jobInsertError = null as any,
  postInsertError = null as any,
  candUpdateError = null as any,
  activeJobStatus = null as string | null,
  failedJobs = 0,
} = {}) {
  const log = {
    jobInserts: [] as any[],
    jobUpdates: [] as any[],
    postInserts: [] as any[],
    postUpdates: [] as any[],
    draftUpdates: [] as any[],
    candUpdates: [] as any[],
  };
  const sb = {
    from: vi.fn((table: string) => {
      switch (table) {
        case "drafts":
          return {
            select: () => node({ data: draft, error: null }),
            update: (v: any) => (log.draftUpdates.push(v), node({ error: null })),
          };
        case "posting_jobs":
          return {
            insert: (v: any) => (log.jobInserts.push(v), node({ data: jobInsertError ? null : JOB, error: jobInsertError })),
            update: (v: any) => (log.jobUpdates.push(v), node({ error: null })),
            select: () => node({ count: failedJobs, data: activeJobStatus ? { status: activeJobStatus } : null, error: null }),
          };
        case "posts":
          return {
            insert: (v: any) => (log.postInserts.push(v), node({ error: postInsertError })),
            update: (v: any) => (log.postUpdates.push(v), node({ error: null })),
          };
        case "candidates":
          return { update: (v: any) => (log.candUpdates.push(v), node({ error: candUpdateError })) };
        default:
          return node({ data: null, error: null });
      }
    }),
  };
  return { sb: sb as any, log };
}

function buildX(createTweet: ReturnType<typeof vi.fn>) {
  const x = { profileId: "p-1", xUserId: "999", username: "cisco", estimatedCostUsd: 0, createTweet };
  return { x, xFor: vi.fn().mockResolvedValue(x) };
}

const lastJobUpdate = (log: ReturnType<typeof buildSb>["log"]) => log.jobUpdates[log.jobUpdates.length - 1];

describe("publishDraft", () => {
  beforeEach(() => {
    vi.mocked(logActivity).mockClear();
  });

  it("refuses a reply draft without touching X or creating a job", async () => {
    const { sb, log } = buildSb({ draft: { ...DRAFT, kind: "reply" } });
    const { xFor } = buildX(vi.fn());
    const out = await publishDraft("draft-1", sb, xFor);
    expect(out).toEqual({ ok: false, reason: expect.stringMatching(/reply/i) });
    expect(xFor).not.toHaveBeenCalled();
    expect(log.jobInserts).toHaveLength(0);
  });

  it.each([["posted"], ["draft"], ["skipped"]])("refuses a draft whose status is %s", async (status) => {
    const { sb, log } = buildSb({ draft: { ...DRAFT, status } });
    const { xFor } = buildX(vi.fn());
    const out = await publishDraft("draft-1", sb, xFor);
    expect(out.ok).toBe(false);
    expect(xFor).not.toHaveBeenCalled();
    expect(log.jobInserts).toHaveLength(0);
  });

  it("accepts a scheduled draft", async () => {
    const { sb } = buildSb({ draft: { ...DRAFT, status: "scheduled" } });
    const { xFor } = buildX(vi.fn().mockResolvedValue({ id: "t1", text: "a plain post" }));
    expect((await publishDraft("draft-1", sb, xFor)).ok).toBe(true);
  });

  it("refuses an empty body", async () => {
    const { sb } = buildSb({ draft: { ...DRAFT, body: "   " } });
    const { xFor } = buildX(vi.fn());
    const out = await publishDraft("draft-1", sb, xFor);
    expect(out).toEqual({ ok: false, reason: expect.stringMatching(/empty/i) });
    expect(xFor).not.toHaveBeenCalled();
  });

  it("refuses a body that still carries a URL (reach rule)", async () => {
    const { sb, log } = buildSb({ draft: { ...DRAFT, body: "read https://example.com now" } });
    const { xFor } = buildX(vi.fn());
    const out = await publishDraft("draft-1", sb, xFor);
    expect(out).toEqual({ ok: false, reason: expect.stringMatching(/url/i) });
    expect(xFor).not.toHaveBeenCalled();
    expect(log.jobInserts).toHaveLength(0);
  });

  it("a 23505 on the active-draft index means in progress / posted: no X call", async () => {
    const { sb, log } = buildSb({ jobInsertError: { code: "23505", message: "dup" } });
    const createTweet = vi.fn();
    const { xFor } = buildX(createTweet);
    const out = await publishDraft("draft-1", sb, xFor);
    expect(out).toEqual({ ok: false, reason: "already in progress or posted" });
    expect(createTweet).not.toHaveBeenCalled();
    expect(xFor).not.toHaveBeenCalled();
    expect(log.jobUpdates).toHaveLength(0);
  });

  describe("pre-job refusal of a SCHEDULED draft bounces it out of the due query", () => {
    it.each([
      ["a URL in the body", { body: "read https://example.com now" }, /url/i],
      ["an empty body", { body: "  " }, /empty/i],
      ["a reply kind", { kind: "reply" }, /reply/i],
    ])("%s: back to approved, reason stored as a failed job, no X call", async (_n, over, reason) => {
      const { sb, log } = buildSb({ draft: { ...DRAFT, status: "scheduled", ...over } });
      const { xFor } = buildX(vi.fn());
      const out = await publishDraft("draft-1", sb, xFor);
      expect(out).toEqual({ ok: false, reason: expect.stringMatching(reason) });
      expect(xFor).not.toHaveBeenCalled();
      expect(log.draftUpdates).toEqual([{ status: "approved" }]);
      expect(log.jobInserts).toEqual([
        expect.objectContaining({ draft_id: "draft-1", method: "xapi", status: "failed", error: expect.stringMatching(reason) }),
      ]);
    });

    it("an APPROVED draft with the same problem is just refused (it is not in the due query)", async () => {
      const { sb, log } = buildSb({ draft: { ...DRAFT, status: "approved", body: "read https://example.com now" } });
      const { xFor } = buildX(vi.fn());
      expect((await publishDraft("draft-1", sb, xFor)).ok).toBe(false);
      expect(log.draftUpdates).toHaveLength(0);
      expect(log.jobInserts).toHaveLength(0);
    });
  });

  it("a 23505 against a needs_manual_confirmation job parks the stuck scheduled draft as unconfirmed", async () => {
    const { sb, log } = buildSb({
      draft: { ...DRAFT, status: "scheduled" },
      jobInsertError: { code: "23505", message: "dup" },
      activeJobStatus: "needs_manual_confirmation",
    });
    const { xFor } = buildX(vi.fn());
    const out = await publishDraft("draft-1", sb, xFor);
    expect(out).toEqual({ ok: false, reason: "already in progress or posted" });
    expect(log.draftUpdates).toEqual([{ status: "unconfirmed" }]);
  });

  it("a 23505 against a running job (a genuine concurrent publish) leaves the draft alone", async () => {
    const { sb, log } = buildSb({
      draft: { ...DRAFT, status: "scheduled" },
      jobInsertError: { code: "23505", message: "dup" },
      activeJobStatus: "running",
    });
    await publishDraft("draft-1", sb, buildX(vi.fn()).xFor);
    expect(log.draftUpdates).toHaveLength(0);
  });

  it("inserts a running xapi job with attempts=1", async () => {
    const { sb, log } = buildSb();
    const { xFor } = buildX(vi.fn().mockResolvedValue({ id: "t1", text: "a plain post" }));
    await publishDraft("draft-1", sb, xFor);
    expect(log.jobInserts[0]).toEqual({
      profile_id: "p-1",
      draft_id: "draft-1",
      method: "xapi",
      status: "running",
      attempts: 1,
    });
  });

  it("happy path: one createTweet, posts row has tweet_id, draft posted, job succeeded", async () => {
    const { sb, log } = buildSb({ draft: { ...DRAFT, candidate_id: "cand-1" } });
    const createTweet = vi.fn().mockResolvedValue({ id: "190", text: "a plain post" });
    const { xFor } = buildX(createTweet);

    const out = await publishDraft("draft-1", sb, xFor);

    expect(out).toEqual({ ok: true, url: "https://x.com/cisco/status/190" });
    expect(xFor).toHaveBeenCalledWith("p-1", sb);
    expect(createTweet).toHaveBeenCalledTimes(1);
    expect(createTweet).toHaveBeenCalledWith({ text: "a plain post" });
    expect(log.postInserts).toEqual([
      { profile_id: "p-1", draft_id: "draft-1", tweet_url: "https://x.com/cisco/status/190", tweet_id: "190" },
    ]);
    expect(log.draftUpdates).toEqual([{ status: "posted" }]);
    expect(log.candUpdates).toEqual([{ status: "engaged" }]);
    expect(lastJobUpdate(log)).toMatchObject({
      status: "succeeded",
      result_url: "https://x.com/cisco/status/190",
      reply_result_url: null,
      error: null,
    });
    expect(logActivity).toHaveBeenCalledWith(sb, "p-1", "post_published", expect.objectContaining({ refId: "draft-1" }));
  });

  it("tolerates a 23505 on the posts insert (already recorded)", async () => {
    const { sb } = buildSb({ postInsertError: { code: "23505", message: "dup" } });
    const { xFor } = buildX(vi.fn().mockResolvedValue({ id: "190", text: "x" }));
    expect((await publishDraft("draft-1", sb, xFor)).ok).toBe(true);
  });

  it("link path: posts the link as reply 1 and stores both urls", async () => {
    const { sb, log } = buildSb({ draft: { ...DRAFT, link_url: "https://example.com/post" } });
    const createTweet = vi
      .fn()
      .mockResolvedValueOnce({ id: "190", text: "a plain post" })
      .mockResolvedValueOnce({ id: "191", text: "https://example.com/post" });
    const { xFor } = buildX(createTweet);

    const out = await publishDraft("draft-1", sb, xFor);

    expect(createTweet).toHaveBeenCalledTimes(2);
    expect(createTweet).toHaveBeenNthCalledWith(2, {
      text: "https://example.com/post",
      reply: { in_reply_to_tweet_id: "190" },
    });
    expect(out).toEqual({
      ok: true,
      url: "https://x.com/cisco/status/190",
      linkUrl: "https://x.com/cisco/status/191",
    });
    expect(log.postUpdates).toEqual([{ link_tweet_url: "https://x.com/cisco/status/191" }]);
    expect(lastJobUpdate(log)).toMatchObject({
      status: "succeeded",
      reply_result_url: "https://x.com/cisco/status/191",
      error: null,
    });
  });

  it("a failed link reply never fails the main post: job succeeded with error, draft stays posted", async () => {
    const { sb, log } = buildSb({ draft: { ...DRAFT, link_url: "https://example.com/post" } });
    const createTweet = vi
      .fn()
      .mockResolvedValueOnce({ id: "190", text: "a plain post" })
      .mockRejectedValueOnce(new Error("X API 403"));
    const { xFor } = buildX(createTweet);

    const out = await publishDraft("draft-1", sb, xFor);

    expect(out).toEqual({ ok: true, url: "https://x.com/cisco/status/190" });
    expect(log.draftUpdates).toEqual([{ status: "posted" }]);
    expect(lastJobUpdate(log)).toMatchObject({ status: "succeeded", error: "link reply failed", reply_result_url: null });
    expect(log.jobUpdates.some((u) => u.status === "failed" || u.status === "needs_manual_confirmation")).toBe(false);
  });

  it("an error before the tweet is sent marks the job failed (safe to retry)", async () => {
    const { sb, log } = buildSb();
    const createTweet = vi.fn().mockRejectedValue(new Error("network down"));
    const { xFor } = buildX(createTweet);

    const out = await publishDraft("draft-1", sb, xFor);

    expect(out).toEqual({ ok: false, reason: "network down" });
    expect(lastJobUpdate(log)).toMatchObject({ status: "failed", error: "network down" });
    expect(log.draftUpdates).toHaveLength(0);
  });

  it("a client-resolution error (e.g. reauth) also counts as a pre-send failure", async () => {
    const { sb, log } = buildSb();
    const xFor = vi.fn().mockRejectedValue(new Error("X account needs re-authorization"));
    const out = await publishDraft("draft-1", sb, xFor);
    expect(out.ok).toBe(false);
    expect(lastJobUpdate(log)).toMatchObject({ status: "failed", error: "X account needs re-authorization" });
  });

  it("an error after the tweet is sent marks needs_manual_confirmation (never auto-retried) and parks the draft", async () => {
    const { sb, log } = buildSb({ postInsertError: { code: "XX000", message: "db down" } });
    const createTweet = vi.fn().mockResolvedValue({ id: "190", text: "a plain post" });
    const { xFor } = buildX(createTweet);

    const out = await publishDraft("draft-1", sb, xFor);

    expect(out).toEqual({ ok: false, reason: "db down" });
    expect(createTweet).toHaveBeenCalledTimes(1);
    expect(lastJobUpdate(log)).toMatchObject({ status: "needs_manual_confirmation", error: "db down" });
    expect(log.draftUpdates).toEqual([{ status: "unconfirmed" }]);
  });

  it("a failure after the draft was already marked posted does not re-park it as unconfirmed", async () => {
    const { sb, log } = buildSb({ draft: { ...DRAFT, candidate_id: "cand-1" }, candUpdateError: { message: "cand write failed" } });
    const { xFor } = buildX(vi.fn().mockResolvedValue({ id: "190", text: "x" }));
    const out = await publishDraft("draft-1", sb, xFor);
    expect(out).toEqual({ ok: false, reason: "cand write failed" });
    expect(lastJobUpdate(log)).toMatchObject({ status: "needs_manual_confirmation" });
    expect(log.draftUpdates).toEqual([{ status: "posted" }]);
  });

  it("after 3 failed attempts the draft goes back to approved so the ticker stops retrying", async () => {
    const { sb, log } = buildSb({ failedJobs: 3 });
    const { xFor } = buildX(vi.fn().mockRejectedValue(new Error("boom")));

    await publishDraft("draft-1", sb, xFor);

    expect(lastJobUpdate(log)).toMatchObject({ status: "failed" });
    expect(log.draftUpdates).toEqual([{ status: "approved" }]);
  });

  it("fewer than 3 failures leaves the draft schedulable", async () => {
    const { sb, log } = buildSb({ failedJobs: 2 });
    const { xFor } = buildX(vi.fn().mockRejectedValue(new Error("boom")));
    await publishDraft("draft-1", sb, xFor);
    expect(log.draftUpdates).toHaveLength(0);
  });
});
