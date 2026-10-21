import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("@/server/publish", () => ({ publishDraft: vi.fn() }));

import { approveAndSchedule, editDraftBody, skipDraft, unscheduleDraft } from "@/server/queue-actions";
import { supabaseServer } from "@/lib/supabase/server";
import { publishDraft } from "@/server/publish";
import { revalidatePath } from "next/cache";

const DRAFT = {
  id: "draft-1",
  profile_id: "p-1",
  kind: "original",
  body: "a plain post",
  status: "draft",
  link_url: null as string | null,
};

function node(result: any): any {
  const n: any = {
    then: (res: any, rej: any) => Promise.resolve(result).then(res, rej),
    catch: (rej: any) => Promise.resolve(result).catch(rej),
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  };
  for (const m of ["select", "eq", "in", "order"]) n[m] = () => n;
  return n;
}

function buildSb({ draft = DRAFT as any, premium = false, updateRows = [{ id: "draft-1" }] as any[], updateError = null as any } = {}) {
  const updates: Array<{ patch: any; filters: Array<[string, unknown]> }> = [];
  const sb = {
    from: vi.fn((table: string) => {
      if (table === "drafts") {
        return {
          select: () => node({ data: draft, error: null }),
          update: (patch: any) => {
            const rec = { patch, filters: [] as Array<[string, unknown]> };
            updates.push(rec);
            const n: any = node({ data: updateError ? null : updateRows, error: updateError });
            n.eq = (k: string, v: unknown) => (rec.filters.push([k, v]), n);
            n.in = (k: string, v: unknown) => (rec.filters.push([k, v]), n);
            return n;
          },
        };
      }
      if (table === "profiles") return { select: () => node({ data: { premium_account: premium }, error: null }) };
      return node({ data: null, error: null });
    }),
  };
  vi.mocked(supabaseServer).mockResolvedValue(sb as any);
  return { sb, updates };
}

describe("approveAndSchedule", () => {
  beforeEach(() => {
    vi.mocked(publishDraft).mockReset().mockResolvedValue({ ok: true, url: "https://x.com/c/status/1" });
    vi.mocked(revalidatePath).mockClear();
  });

  it("not found / not visible under RLS", async () => {
    buildSb({ draft: null });
    expect(await approveAndSchedule("nope", null)).toEqual({ ok: false, error: "draft not found" });
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it("refuses to schedule a reply", async () => {
    const { updates } = buildSb({ draft: { ...DRAFT, kind: "reply" } });
    const out = await approveAndSchedule("draft-1", null);
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/repl/i) });
    expect(updates).toHaveLength(0);
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it.each([["posted"], ["skipped"], ["unconfirmed"]])("refuses a draft already %s", async (status) => {
    const { updates } = buildSb({ draft: { ...DRAFT, status } });
    const out = await approveAndSchedule("draft-1", null);
    expect(out.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("refuses a body with a URL in the middle", async () => {
    const { updates } = buildSb({ draft: { ...DRAFT, body: "see https://a.co/x for more" } });
    const out = await approveAndSchedule("draft-1", null);
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/url|link/i) });
    expect(updates).toHaveLength(0);
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it("lifts a trailing URL into link_url", async () => {
    const { updates } = buildSb({ draft: { ...DRAFT, body: "a thought\n\nhttps://a.co/x" } });
    await approveAndSchedule("draft-1", "2030-01-01T10:00:00.000Z");
    expect(updates[0].patch).toMatchObject({ body: "a thought", link_url: "https://a.co/x" });
  });

  it("refuses an empty body (e.g. a URL-only draft)", async () => {
    const { updates } = buildSb({ draft: { ...DRAFT, body: "https://a.co/x" } });
    const out = await approveAndSchedule("draft-1", null);
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/empty/i) });
    expect(updates).toHaveLength(0);
  });

  it("scheduledAt === null: schedules for now and publishes inline", async () => {
    const { updates } = buildSb();
    const before = Date.now();
    const out = await approveAndSchedule("draft-1", null);
    expect(out).toEqual({ ok: true, published: true });
    expect(updates[0].patch.status).toBe("scheduled");
    expect(new Date(updates[0].patch.scheduled_at).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(publishDraft).toHaveBeenCalledWith("draft-1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/compose");
  });

  it("a transient inline publish failure leaves it scheduled for the ticker", async () => {
    buildSb();
    vi.mocked(publishDraft).mockResolvedValue({ ok: false, reason: "network down" });
    expect(await approveAndSchedule("draft-1", null)).toEqual({ ok: true, published: false });
  });

  it("a future scheduledAt stores the time and does not publish", async () => {
    const { updates } = buildSb();
    const out = await approveAndSchedule("draft-1", "2030-05-06T07:08:09+02:00");
    expect(out).toEqual({ ok: true, published: false });
    expect(updates[0].patch).toMatchObject({ status: "scheduled", scheduled_at: "2030-05-06T05:08:09.000Z" });
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it("rejects an unparseable scheduledAt", async () => {
    const { updates } = buildSb();
    const out = await approveAndSchedule("draft-1", "tomorrow-ish");
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/date|time/i) });
    expect(updates).toHaveLength(0);
  });

  it("enforces the 280 limit on the post-extraction text", async () => {
    const { updates } = buildSb({ draft: { ...DRAFT, body: "x".repeat(281) } });
    const out = await approveAndSchedule("draft-1", null);
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/280/) });
    expect(updates).toHaveLength(0);
  });

  it("a trailing link does not count toward the limit once lifted", async () => {
    buildSb({ draft: { ...DRAFT, body: `${"x".repeat(270)} https://example.com/a/very/long/path/that/is/long` } });
    expect((await approveAndSchedule("draft-1", "2030-01-01T00:00:00Z")).ok).toBe(true);
  });

  it("premium accounts may use long-form up to 4000", async () => {
    buildSb({ draft: { ...DRAFT, body: "x".repeat(3000) }, premium: true });
    expect((await approveAndSchedule("draft-1", "2030-01-01T00:00:00Z")).ok).toBe(true);
    buildSb({ draft: { ...DRAFT, body: "x".repeat(4001) }, premium: true });
    expect((await approveAndSchedule("draft-1", "2030-01-01T00:00:00Z")).ok).toBe(false);
  });

  it("reports a lost status race (no row updated) instead of publishing", async () => {
    buildSb({ updateRows: [] });
    const out = await approveAndSchedule("draft-1", null);
    expect(out.ok).toBe(false);
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it("surfaces a database error", async () => {
    buildSb({ updateError: { message: "db down" } });
    expect(await approveAndSchedule("draft-1", null)).toEqual({ ok: false, error: "db down" });
  });
});

describe("editDraftBody", () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear();
  });

  it("trims and saves", async () => {
    const { updates } = buildSb();
    expect(await editDraftBody("draft-1", "  new body \n")).toEqual({ ok: true });
    expect(updates[0].patch).toEqual({ body: "new body" });
    expect(updates[0].filters).toContainEqual(["status", ["draft", "approved", "scheduled"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/compose");
  });

  it("refuses empty", async () => {
    const { updates } = buildSb();
    expect(await editDraftBody("draft-1", "   ")).toEqual({ ok: false, error: expect.stringMatching(/empty/i) });
    expect(updates).toHaveLength(0);
  });

  it("enforces 280 for normal accounts and 4000 for premium", async () => {
    buildSb();
    expect((await editDraftBody("draft-1", "x".repeat(280))).ok).toBe(true);
    expect(await editDraftBody("draft-1", "x".repeat(281))).toEqual({ ok: false, error: expect.stringMatching(/280/) });
    buildSb({ premium: true });
    expect((await editDraftBody("draft-1", "x".repeat(4000))).ok).toBe(true);
    expect(await editDraftBody("draft-1", "x".repeat(4001))).toEqual({ ok: false, error: expect.stringMatching(/4000/) });
  });

  it("refuses a draft that is no longer editable", async () => {
    const { updates } = buildSb({ draft: { ...DRAFT, status: "posted" } });
    expect((await editDraftBody("draft-1", "x")).ok).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("not found", async () => {
    buildSb({ draft: null });
    expect(await editDraftBody("nope", "x")).toEqual({ ok: false, error: "draft not found" });
  });
});

describe("skipDraft / unscheduleDraft", () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear();
  });

  it("skipDraft marks skipped, only from an open status", async () => {
    const { updates } = buildSb();
    expect(await skipDraft("draft-1")).toEqual({ ok: true });
    expect(updates[0].patch).toEqual({ status: "skipped" });
    expect(updates[0].filters).toContainEqual(["status", ["draft", "approved", "scheduled"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/compose");
  });

  it("skipDraft reports when nothing was updated (already posted)", async () => {
    buildSb({ updateRows: [] });
    expect((await skipDraft("draft-1")).ok).toBe(false);
  });

  it("unscheduleDraft goes back to approved with no time, only from scheduled", async () => {
    const { updates } = buildSb();
    expect(await unscheduleDraft("draft-1")).toEqual({ ok: true });
    expect(updates[0].patch).toEqual({ status: "approved", scheduled_at: null });
    expect(updates[0].filters).toContainEqual(["status", "scheduled"]);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
