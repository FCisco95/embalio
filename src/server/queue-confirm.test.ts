import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn(), supabaseService: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));

import { confirmNotPublished, confirmPublished } from "@/server/queue-actions";
import { publishDraft } from "@/server/publish";
import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Row = Record<string, any>;

/**
 * Stateful in-memory fake of the four tables involved, including the two unique rules
 * that matter here: posting_jobs_active_draft_uidx (partial, on running / succeeded /
 * needs_manual_confirmation) and posts (profile_id, tweet_id).
 */
function makeDb(seed: { drafts?: Row[]; posting_jobs?: Row[]; posts?: Row[] }) {
  const tables: Record<string, Row[]> = {
    drafts: [...(seed.drafts ?? [])],
    posting_jobs: [...(seed.posting_jobs ?? [])],
    posts: [...(seed.posts ?? [])],
    candidates: [],
    profiles: [{ id: "p-1", premium_account: false }],
  };
  let seq = 0;
  const ACTIVE = ["running", "succeeded", "needs_manual_confirmation"];

  function from(table: string) {
    let op: "select" | "insert" | "update" = "select";
    let patch: Row = {};
    let inserted: Row[] = [];
    const filters: Array<(r: Row) => boolean> = [];
    let order: { col: string; asc: boolean } | null = null;
    let limitN: number | null = null;
    let returning = false;
    let failure: { code: string; message: string } | null = null;

    const run = () => {
      if (failure) return { data: null, error: failure };
      const matched = tables[table].filter((r) => filters.every((f) => f(r)));
      if (op === "insert") return { data: inserted, error: null };
      if (op === "update") {
        for (const r of matched) Object.assign(r, patch);
        return { data: matched.map((r) => ({ id: r.id })), error: null };
      }
      let rows = [...matched];
      if (order) rows.sort((a, b) => (a[order!.col] < b[order!.col] ? -1 : 1) * (order!.asc ? 1 : -1));
      if (limitN !== null) rows = rows.slice(0, limitN);
      return { data: rows, error: null };
    };

    const b: any = {
      select: () => ((returning = true), b),
      insert: (v: Row | Row[]) => {
        op = "insert";
        const list = Array.isArray(v) ? v : [v];
        for (const row of list) {
          const full = { id: `${table}-${++seq}`, created_at: String(1000 + seq).padStart(6, "0"), ...row };
          if (table === "posting_jobs" && ACTIVE.includes(full.status)) {
            const clash = tables.posting_jobs.some((r) => r.draft_id === full.draft_id && ACTIVE.includes(r.status));
            if (clash) failure = { code: "23505", message: "duplicate key value violates posting_jobs_active_draft_uidx" };
          }
          if (table === "posts" && full.tweet_id) {
            const clash = tables.posts.some((r) => r.profile_id === full.profile_id && r.tweet_id === full.tweet_id);
            if (clash) failure = { code: "23505", message: "duplicate key value violates posts_profile_tweet_id_uidx" };
          }
          if (!failure) {
            tables[table].push(full);
            inserted.push(full);
          }
        }
        return b;
      },
      update: (p: Row) => ((op = "update"), (patch = p), b),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), b),
      limit: (n: number) => ((limitN = n), b),
      maybeSingle: async () => {
        const r = run();
        return { data: r.data?.[0] ?? null, error: r.error };
      },
      single: async () => {
        const r = run();
        return { data: r.data?.[0] ?? null, error: r.error };
      },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    void returning;
    return b;
  }
  return { sb: { from } as any, tables };
}

const UNCONFIRMED = {
  id: "d-1",
  profile_id: "p-1",
  kind: "original",
  body: "a plain post",
  status: "unconfirmed",
  link_url: null,
  candidate_id: null,
};
const STUCK_JOB = {
  id: "job-0",
  profile_id: "p-1",
  draft_id: "d-1",
  method: "xapi",
  status: "needs_manual_confirmation",
  error: "The operation timed out.",
  created_at: "000500",
};
const URL_OK = "https://x.com/cisco/status/1234567890123";

function setup(over: { draft?: Row | null; jobs?: Row[]; posts?: Row[] } = {}) {
  const db = makeDb({
    drafts: over.draft === null ? [] : [over.draft ?? { ...UNCONFIRMED }],
    posting_jobs: over.jobs ?? [{ ...STUCK_JOB }],
    posts: over.posts ?? [],
  });
  vi.mocked(supabaseServer).mockResolvedValue(db.sb);
  return db;
}

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
});

describe("confirmPublished", () => {
  it("records the post, marks the draft posted and the stuck job succeeded with the URL", async () => {
    const { tables } = setup();
    expect(await confirmPublished("d-1", ` ${URL_OK} `)).toEqual({ ok: true });

    expect(tables.posts).toHaveLength(1);
    expect(tables.posts[0]).toMatchObject({
      profile_id: "p-1",
      draft_id: "d-1",
      tweet_url: URL_OK,
      tweet_id: "1234567890123",
    });
    expect(typeof tables.posts[0].posted_at).toBe("string");
    expect(tables.drafts[0].status).toBe("posted");
    expect(tables.posting_jobs[0]).toMatchObject({ status: "succeeded", result_url: URL_OK });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("only touches the LATEST needs_manual_confirmation job", async () => {
    const { tables } = setup({
      jobs: [
        { ...STUCK_JOB, id: "job-old", status: "failed", created_at: "000100" },
        { ...STUCK_JOB, id: "job-new", created_at: "000900" },
      ],
    });
    await confirmPublished("d-1", URL_OK);
    expect(tables.posting_jobs.find((j) => j.id === "job-new")!.status).toBe("succeeded");
    expect(tables.posting_jobs.find((j) => j.id === "job-old")!.status).toBe("failed");
  });

  it("is idempotent against a posts row that already exists (23505 ignored)", async () => {
    const { tables } = setup({ posts: [{ id: "post-9", profile_id: "p-1", draft_id: "d-1", tweet_id: "1234567890123", tweet_url: URL_OK }] });
    expect(await confirmPublished("d-1", URL_OK)).toEqual({ ok: true });
    expect(tables.posts).toHaveLength(1);
    expect(tables.drafts[0].status).toBe("posted");
  });

  it.each([[""], ["not a url"], ["https://example.com/cisco/status/123"], ["https://x.com/cisco"]])(
    "rejects %j as a tweet URL without writing",
    async (bad) => {
      const { tables } = setup();
      const out = await confirmPublished("d-1", bad);
      expect(out).toEqual({ ok: false, error: expect.stringMatching(/tweet url/i) });
      expect(tables.posts).toHaveLength(0);
      expect(tables.drafts[0].status).toBe("unconfirmed");
    },
  );

  it.each([["approved"], ["scheduled"], ["posted"], ["draft"]])("refuses a draft that is %s (only unconfirmed)", async (status) => {
    const { tables } = setup({ draft: { ...UNCONFIRMED, status } });
    const out = await confirmPublished("d-1", URL_OK);
    expect(out.ok).toBe(false);
    expect(tables.posts).toHaveLength(0);
  });

  it("not found / not visible under RLS", async () => {
    setup({ draft: null });
    expect(await confirmPublished("d-1", URL_OK)).toEqual({ ok: false, error: "draft not found" });
  });

  it("still works when the stuck job row is missing", async () => {
    const { tables } = setup({ jobs: [] });
    expect(await confirmPublished("d-1", URL_OK)).toEqual({ ok: true });
    expect(tables.drafts[0].status).toBe("posted");
  });
});

describe("confirmNotPublished", () => {
  it("fails the stuck job and returns the draft to approved", async () => {
    const { tables } = setup();
    expect(await confirmNotPublished("d-1")).toEqual({ ok: true });
    expect(tables.posting_jobs[0]).toMatchObject({ status: "failed", error: "operator confirmed not published" });
    expect(tables.drafts[0].status).toBe("approved");
    expect(tables.posts).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it.each([["approved"], ["scheduled"], ["posted"], ["draft"]])("refuses a draft that is %s", async (status) => {
    const { tables } = setup({ draft: { ...UNCONFIRMED, status } });
    expect((await confirmNotPublished("d-1")).ok).toBe(false);
    expect(tables.posting_jobs[0].status).toBe("needs_manual_confirmation");
  });

  it("not found / not visible under RLS", async () => {
    setup({ draft: null });
    expect(await confirmNotPublished("d-1")).toEqual({ ok: false, error: "draft not found" });
  });

  it("releases the idempotency index: before it a publish is blocked, after it a NEW job is inserted", async () => {
    const { sb, tables } = setup();
    const x = { profileId: "p-1", xUserId: "9", username: "cisco", estimatedCostUsd: 0, createTweet: vi.fn().mockResolvedValue({ id: "777", text: "a plain post" }) };
    const xFor = vi.fn().mockResolvedValue(x);

    // The draft must be approved/scheduled for publishDraft to even try; force the index clash
    // by putting it back to approved WITHOUT failing the job (the pre-F6 stuck state).
    tables.drafts[0].status = "approved";
    const blocked = await publishDraft("d-1", sb, xFor);
    expect(blocked).toEqual({ ok: false, reason: expect.stringMatching(/already in progress/) });
    expect(x.createTweet).not.toHaveBeenCalled();
    expect(tables.posting_jobs).toHaveLength(1);

    // Operator resolves it properly.
    tables.drafts[0].status = "unconfirmed";
    await confirmNotPublished("d-1");
    expect(tables.drafts[0].status).toBe("approved");

    const retried = await publishDraft("d-1", sb, xFor);
    expect(retried).toEqual({ ok: true, url: "https://x.com/cisco/status/777" });
    expect(x.createTweet).toHaveBeenCalledTimes(1);
    expect(tables.posting_jobs).toHaveLength(2);
    expect(tables.posting_jobs.map((j) => j.status).sort()).toEqual(["failed", "succeeded"]);
  });
});
