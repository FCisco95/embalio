import { describe, expect, it, vi } from "vitest";
import { combinedQueueBody, runNightly, type NightlyDeps } from "./nightly-run";
import type { NightlyArgs } from "./nightly";

const profile = (id: string, handle: string, over: Record<string, unknown> = {}) => ({
  id,
  handle,
  niche_description: "indie hackers",
  voice_corpus: [] as string[],
  voice_notes: null,
  voice_spec: "short, concrete, first person",
  content_pillars: [] as string[],
  premium_account: false,
  ...over,
});

const WORDS = ["cron", "pricing", "onboarding", "churn", "latency", "hiring"];
// Distinct word sets, so validateDraftItems' near-duplicate filter keeps them all.
const item = (n: number) => ({
  body: `${WORDS[n % WORDS.length]} lesson ${WORDS[(n + 2) % WORDS.length]} ${WORDS[(n + 3) % WORDS.length]} number${n} alpha${n} beta${n} gamma${n}`,
  angle: "build in public",
  rationale: "concrete",
  link_url: null,
  suggested_hour_lisbon: 9,
});

/** Chainable, thenable query node resolving to `result`. */
function node(result: unknown): any {
  const n: any = { then: (res: any, rej: any) => Promise.resolve(result).then(res, rej) };
  for (const m of ["select", "eq", "gte", "order", "limit"]) n[m] = () => n;
  return n;
}

function makeDeps(opts: {
  profiles: ReturnType<typeof profile>[];
  /** original `draft`-status rows already in the window, per profile id */
  existing?: Record<string, number>;
  /** draft items the generator returns, per profile id (default: 2 items) */
  items?: Record<string, ReturnType<typeof item>[] | null>;
  insertError?: string;
  notifyThrows?: boolean;
}) {
  const inserted: Array<{ rows: any[] }> = [];
  const logs: string[] = [];
  const errors: unknown[][] = [];
  let currentProfile = "";
  const sb = {
    from: (table: string) => {
      if (table === "profiles") return node({ data: opts.profiles, error: null });
      if (table === "topic_history") return node({ data: [], error: null });
      return {
        select: (_cols: string, o?: { head?: boolean }) => {
          const n = node(o?.head ? { count: 0, error: null } : { data: [], error: null });
          if (o?.head) {
            const filters: Record<string, unknown> = {};
            const q: any = {
              eq: (k: string, v: unknown) => ((filters[k] = v), q),
              gte: () => q,
              then: (res: any, rej: any) =>
                Promise.resolve({ count: opts.existing?.[String(filters.profile_id)] ?? 0, error: null }).then(res, rej),
            };
            return q;
          }
          const q: any = {
            eq: (k: string, v: unknown) => {
              if (k === "profile_id") currentProfile = String(v);
              return q;
            },
            gte: () => q,
            order: () => q,
            limit: () => q,
            then: (res: any, rej: any) => n.then(res, rej),
          };
          return q;
        },
        insert: (rows: any[]) => {
          if (opts.insertError) return Promise.resolve({ error: { message: opts.insertError } });
          inserted.push({ rows });
          return Promise.resolve({ error: null });
        },
      };
    },
  } as any;

  const generate = vi.fn(async () => {
    const forProfile = opts.items?.[currentProfile];
    if (forProfile === null) return { data: null, raw: "" };
    return { data: forProfile ?? [item(1), item(2)] };
  }) as unknown as NightlyDeps["generate"];
  const notify = vi.fn(async () => {
    if (opts.notifyThrows) throw new Error("telegram down");
  });
  const scan = vi.fn(async () => null) as unknown as NightlyDeps["scan"];
  const deps: NightlyDeps = {
    sb,
    generate,
    scan,
    notify,
    env: {},
    now: () => new Date("2026-10-22T06:30:00Z"),
    log: (m) => void logs.push(m),
    error: (...a) => void errors.push(a),
  };
  return { deps, inserted, logs, errors, notify, generate };
}

const ARGS: NightlyArgs = { profile: undefined, dryRun: false, max: 3 };

describe("runNightly", () => {
  it("skips a profile whose queue is already full and generates nothing for it", async () => {
    const { deps, generate, inserted, notify, logs } = makeDeps({
      profiles: [profile("p1", "a")],
      existing: { p1: 3 },
    });
    const { summary, exitCode } = await runNightly(ARGS, deps);
    expect(generate).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ profiles: 1, inserted: 0, skipped: 1, failed: 0 });
    expect(logs.join("\n")).toMatch(/queue full: @a/);
    expect(exitCode).toBe(0);
  });

  it("skips ineligible profiles (no voice spec, no pillars)", async () => {
    const { deps, generate } = makeDeps({ profiles: [profile("p1", "a", { voice_spec: null })] });
    const { summary } = await runNightly(ARGS, deps);
    expect(generate).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ profiles: 0, skipped: 1 });
  });

  it("dry-run writes nothing and notifies nothing", async () => {
    const { deps, inserted, notify, logs } = makeDeps({ profiles: [profile("p1", "a")] });
    const { summary, exitCode } = await runNightly({ ...ARGS, dryRun: true }, deps);
    expect(inserted).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
    expect(summary.inserted).toBe(2);
    expect(logs.join("\n")).toContain('"handle": "a"');
    expect(exitCode).toBe(0);
  });

  it("sends ONE combined notification for several profiles, listing each inserted count", async () => {
    const { deps, inserted, notify } = makeDeps({
      profiles: [profile("p1", "a"), profile("p2", "@b")],
      items: { p1: [item(1), item(2), item(3)], p2: [item(4), item(5)] },
    });
    const { summary, exitCode } = await runNightly(ARGS, deps);
    expect(inserted).toHaveLength(2);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(["p1", "p2"], {
      title: "Fila pronta",
      body: "A tua fila está pronta: @a (3), @b (2)",
      url: "/",
    });
    expect(summary).toMatchObject({ profiles: 2, inserted: 5, failed: 0 });
    expect(exitCode).toBe(0);
  });

  it("notifies only the profiles that actually got drafts", async () => {
    const { deps, notify } = makeDeps({
      profiles: [profile("p1", "a"), profile("p2", "b")],
      existing: { p1: 3 },
    });
    await runNightly(ARGS, deps);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(["p2"], expect.objectContaining({ body: "A tua fila está pronta: @b (2)" }));
  });

  it("does not notify when nothing was inserted", async () => {
    const { deps, notify } = makeDeps({ profiles: [profile("p1", "a")], items: { p1: [{ ...item(1), body: "see https://x.com/a" }] } });
    const { summary } = await runNightly(ARGS, deps);
    expect(summary.inserted).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("exit code is 1 only when every eligible profile failed", async () => {
    const all = makeDeps({ profiles: [profile("p1", "a"), profile("p2", "b")], items: { p1: null, p2: null } });
    expect((await runNightly(ARGS, all.deps)).exitCode).toBe(1);
    expect(all.notify).not.toHaveBeenCalled();

    const partial = makeDeps({ profiles: [profile("p1", "a"), profile("p2", "b")], items: { p1: null } });
    const out = await runNightly(ARGS, partial.deps);
    expect(out.exitCode).toBe(0);
    expect(out.summary).toMatchObject({ failed: 1, inserted: 2 });
  });

  it("a failing insert counts as a failed profile and is not announced", async () => {
    const { deps, notify } = makeDeps({ profiles: [profile("p1", "a")], insertError: "db down" });
    const { summary, exitCode } = await runNightly(ARGS, deps);
    expect(summary.failed).toBe(1);
    expect(exitCode).toBe(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it("a notify failure is logged but never fails the run", async () => {
    const { deps, errors } = makeDeps({ profiles: [profile("p1", "a")], notifyThrows: true });
    const { exitCode } = await runNightly(ARGS, deps);
    expect(exitCode).toBe(0);
    expect(errors.some((e) => String(e[0]).includes("notify FAILED"))).toBe(true);
  });
});

describe("combinedQueueBody", () => {
  it("lists handle (count) per account, normalising the leading @", () => {
    const m = new Map([
      ["1", { handle: "a", rows: [{}, {}, {}] as any[] }],
      ["2", { handle: "@b", rows: [{}] as any[] }],
    ]);
    expect(combinedQueueBody(m)).toBe("A tua fila está pronta: @a (3), @b (1)");
  });
});
