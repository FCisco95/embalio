// Orchestration of the nightly drafts job, with every side effect injected so it can be
// tested (scripts/nightly-drafts.ts is the thin entry that wires the real deps).
// No I/O of its own and no @/lib/supabase/server import: scripts/*.ts run outside Next.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { generateStructured } from "@/lib/generate";
import { buildNightlyDraftsPrompt, buildVoiceSystem, buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import {
  NightlyDraftsSchema,
  QUEUE_WINDOW_HOURS,
  buildDraftInsert,
  isEligibleProfile,
  validateDraftItems,
  type DraftInsert,
  type NightlyArgs,
} from "./nightly";
import { estimateXaiCostUsd, type laneScan } from "./xsearch";

type Sb = SupabaseClient<Database>;
export type NightlyProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id" | "handle" | "niche_description" | "voice_corpus" | "voice_notes"
  | "voice_spec" | "content_pillars" | "premium_account"
>;

export const NIGHTLY_PROFILE_COLUMNS =
  "id, handle, niche_description, voice_corpus, voice_notes, voice_spec, content_pillars, premium_account";
const HISTORY_LIMIT = 30;
// Some profiles store the handle with a leading "@", some without.
const at = (h: string) => `@${h.replace(/^@/, "")}`;

export interface NightlyDeps {
  sb: Sb;
  generate: typeof generateStructured;
  scan: typeof laneScan;
  /** ONE call per run, with the ids of every profile that got drafts. */
  notify: (profileIds: string[], payload: { title: string; body: string; url: string }) => Promise<void>;
  env: { xaiApiKey?: string; xaiModel?: string };
  now?: () => Date;
  log?: (msg: string) => void;
  error?: (...args: unknown[]) => void;
}

export interface NightlySummary {
  profiles: number;
  inserted: number;
  skipped: number;
  failed: number;
  estimatedXaiCostUsd: number;
}

interface Totals {
  inserted: number;
  skipped: number;
  failed: number;
  xaiPosts: number;
}
type Inserts = Map<string, { handle: string; rows: DraftInsert[] }>;
type Io = { log: (msg: string) => void; error: (...args: unknown[]) => void };

async function loadContext(sb: Sb, p: NightlyProfileRow, since: string) {
  const [posted, pending, topics] = await Promise.all([
    sb.from("drafts").select("body").eq("profile_id", p.id).eq("status", "posted")
      .order("created_at", { ascending: false }).limit(HISTORY_LIMIT),
    sb.from("drafts").select("body").eq("profile_id", p.id).eq("kind", "original").eq("status", "draft")
      .gte("created_at", since),
    sb.from("topic_history").select("topic, angle").eq("profile_id", p.id).eq("status", "fresh")
      .order("score", { ascending: false, nullsFirst: false }).limit(3),
  ]);
  for (const r of [posted, pending, topics]) if (r.error) throw new Error(r.error.message);
  return {
    posted: (posted.data ?? []).map((d) => d.body),
    pending: (pending.data ?? []).map((d) => d.body),
    topics: topics.data ?? [],
  };
}

async function processProfile(
  deps: NightlyDeps,
  io: Io,
  p: NightlyProfileRow,
  opts: { dryRun: boolean; max: number },
  totals: Totals,
  inserts: Inserts,
): Promise<void> {
  const { sb } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const since = new Date(now.getTime() - QUEUE_WINDOW_HOURS * 3600_000).toISOString();

  const { count, error: cErr } = await sb.from("drafts").select("id", { count: "exact", head: true })
    .eq("profile_id", p.id).eq("kind", "original").eq("status", "draft").gte("created_at", since);
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) >= opts.max) {
    io.log(`queue full: ${at(p.handle)} (${count} draft(s) in the last ${QUEUE_WINDOW_HOURS}h)`);
    totals.skipped++;
    return;
  }

  const ctx = await loadContext(sb, p, since);
  const doNotRephrase = [...ctx.posted, ...ctx.pending, ...(p.voice_corpus ?? [])];

  const apiKey = deps.env.xaiApiKey;
  const scan = apiKey && p.content_pillars.length > 0
    ? await deps.scan({ apiKey, model: deps.env.xaiModel, pillars: p.content_pillars, handle: p.handle })
    : null;
  if (scan) totals.xaiPosts += scan.posts_returned_estimate;

  const voiceSystem = p.voice_spec?.trim()
    ? buildVoiceSystemFromSpec(p)
    : buildVoiceSystem({
        handle: p.handle,
        niche_description: p.niche_description,
        voice_corpus: p.voice_corpus ?? [],
        voice_notes: p.voice_notes,
      });
  const prompt = buildNightlyDraftsPrompt({
    voiceSystem,
    pillars: p.content_pillars,
    topics: ctx.topics,
    laneScan: scan,
    doNotRephrase,
    max: opts.max,
    premium: p.premium_account,
  });

  const gen = await deps.generate(NightlyDraftsSchema, prompt, { research: true, attempts: 2 });
  if (gen.data === null) throw new Error("generation returned no valid JSON array");

  const { accepted, rejected } = validateDraftItems(gen.data.slice(0, opts.max), {
    premium: p.premium_account,
    doNotRephrase,
  });
  for (const r of rejected) io.log(`dropped draft for ${at(p.handle)}: ${r.reason}`);
  if (accepted.length === 0) {
    io.log(`nothing usable for ${at(p.handle)}: all ${rejected.length} draft(s) rejected`);
    return;
  }

  const rows = accepted.map((item) => buildDraftInsert(item, p, now));
  if (opts.dryRun) {
    io.log(JSON.stringify({ handle: p.handle, drafts: rows }, null, 2));
  } else {
    const { error } = await sb.from("drafts").insert(rows);
    if (error) throw new Error(error.message);
    io.log(`drafts written: ${at(p.handle)} -> ${rows.length}`);
  }
  totals.inserted += rows.length;
  inserts.set(p.id, { handle: p.handle, rows });
}

/** "A tua fila está pronta: @a (3), @b (2)" */
export function combinedQueueBody(inserts: Inserts): string {
  const parts = [...inserts.values()].map(({ handle, rows }) => `${at(handle)} (${rows.length})`);
  return `A tua fila está pronta: ${parts.join(", ")}`;
}

export async function runNightly(
  args: NightlyArgs,
  deps: NightlyDeps,
): Promise<{ summary: NightlySummary; exitCode: 0 | 1 }> {
  const io: Io = { log: deps.log ?? console.log, error: deps.error ?? console.error };

  let query = deps.sb.from("profiles").select(NIGHTLY_PROFILE_COLUMNS);
  if (args.profile) query = query.eq("id", args.profile);
  const { data: all, error } = await query;
  if (error) throw new Error(error.message);

  const totals: Totals = { inserted: 0, skipped: 0, failed: 0, xaiPosts: 0 };
  const profiles = ((all ?? []) as unknown as NightlyProfileRow[]).filter((p) => {
    if (isEligibleProfile(p)) return true;
    io.log(`skipped ${at(p.handle)}: no voice spec and no content pillars`);
    totals.skipped++;
    return false;
  });

  const inserts: Inserts = new Map();
  for (const p of profiles) {
    try {
      await processProfile(deps, io, p, args, totals, inserts);
    } catch (e) {
      totals.failed++;
      io.error(`nightly FAILED: ${at(p.handle)}:`, e instanceof Error ? e.message : e);
    }
  }

  // One combined notification per run (not per profile), only when something was written.
  if (!args.dryRun && inserts.size > 0) {
    try {
      await deps.notify([...inserts.keys()], { title: "Fila pronta", body: combinedQueueBody(inserts), url: "/" });
    } catch (e) {
      io.error("notify FAILED:", e instanceof Error ? e.message : e);
    }
  }

  const summary: NightlySummary = {
    profiles: profiles.length,
    inserted: totals.inserted,
    skipped: totals.skipped,
    failed: totals.failed,
    estimatedXaiCostUsd: Number(estimateXaiCostUsd(totals.xaiPosts).toFixed(4)),
  };
  // Every eligible profile failed = job failure; partial success keeps the green.
  return { summary, exitCode: profiles.length > 0 && totals.failed === profiles.length ? 1 : 0 };
}
