// GH Actions / local worker: write tomorrow's queue of ORIGINAL post drafts for every
// managed account (1-3 each, with angle + rationale), for approval from a phone.
// Builds its own service-role client — must NOT import src/lib/supabase/server
// (that module pulls next/headers, which dies outside a Next request).
//
//   npx tsx scripts/nightly-drafts.ts [--profile <id>] [--dry-run] [--max <1-3>]
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";
import { generateStructured } from "../src/lib/generate";
import { notify } from "../src/lib/notify";
import { buildNotifyDeps } from "../src/server/notify-deps";
import { buildNightlyDraftsPrompt, buildVoiceSystem, buildVoiceSystemFromSpec } from "../src/lib/voice-prompt";
import {
  NightlyDraftsSchema,
  QUEUE_WINDOW_HOURS,
  buildDraftInsert,
  isEligibleProfile,
  parseNightlyArgs,
  validateDraftItems,
  type DraftInsert,
} from "../src/lib/engine/nightly";
import { estimateXaiCostUsd, laneScan } from "../src/lib/engine/xsearch";

type Sb = SupabaseClient<Database>;
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id" | "handle" | "niche_description" | "voice_corpus" | "voice_notes"
  | "voice_spec" | "content_pillars" | "premium_account"
>;

const PROFILE_COLUMNS =
  "id, handle, niche_description, voice_corpus, voice_notes, voice_spec, content_pillars, premium_account";
const HISTORY_LIMIT = 30;
// Some profiles store the handle with a leading "@", some without.
const at = (h: string) => `@${h.replace(/^@/, "")}`;

interface Totals {
  inserted: number;
  skipped: number;
  failed: number;
  xaiPosts: number;
}

async function loadContext(sb: Sb, p: ProfileRow, since: string) {
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
  sb: Sb,
  p: ProfileRow,
  opts: { dryRun: boolean; max: number },
  totals: Totals,
  inserts: Map<string, { handle: string; rows: DraftInsert[] }>,
): Promise<void> {
  const now = new Date();
  const since = new Date(now.getTime() - QUEUE_WINDOW_HOURS * 3600_000).toISOString();

  const { count, error: cErr } = await sb.from("drafts").select("id", { count: "exact", head: true })
    .eq("profile_id", p.id).eq("kind", "original").eq("status", "draft").gte("created_at", since);
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) >= opts.max) {
    console.log(`queue full: ${at(p.handle)} (${count} draft(s) in the last ${QUEUE_WINDOW_HOURS}h)`);
    totals.skipped++;
    return;
  }

  const ctx = await loadContext(sb, p, since);
  const doNotRephrase = [...ctx.posted, ...ctx.pending, ...(p.voice_corpus ?? [])];

  const apiKey = process.env.XAI_API_KEY;
  const scan = apiKey && p.content_pillars.length > 0
    ? await laneScan({ apiKey, model: process.env.XAI_MODEL, pillars: p.content_pillars, handle: p.handle })
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

  const gen = await generateStructured(NightlyDraftsSchema, prompt, { research: true, attempts: 2 });
  if (gen.data === null) throw new Error("generation returned no valid JSON array");

  const { accepted, rejected } = validateDraftItems(gen.data.slice(0, opts.max), {
    premium: p.premium_account,
    doNotRephrase,
  });
  for (const r of rejected) console.log(`dropped draft for ${at(p.handle)}: ${r.reason}`);
  if (accepted.length === 0) {
    console.log(`nothing usable for ${at(p.handle)}: all ${rejected.length} draft(s) rejected`);
    return;
  }

  const rows = accepted.map((item) => buildDraftInsert(item, p, now));
  if (opts.dryRun) {
    console.log(JSON.stringify({ handle: p.handle, drafts: rows }, null, 2));
  } else {
    const { error } = await sb.from("drafts").insert(rows);
    if (error) throw new Error(error.message);
    console.log(`drafts written: ${at(p.handle)} → ${rows.length}`);
  }
  totals.inserted += rows.length;
  inserts.set(p.id, { handle: p.handle, rows });
}

async function main() {
  const args = parseNightlyArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient<Database>(url, key, { auth: { persistSession: false } });

  let query = sb.from("profiles").select(PROFILE_COLUMNS);
  if (args.profile) query = query.eq("id", args.profile);
  const { data: all, error } = await query;
  if (error) throw new Error(error.message);

  const totals: Totals = { inserted: 0, skipped: 0, failed: 0, xaiPosts: 0 };
  const profiles = ((all ?? []) as unknown as ProfileRow[]).filter((p) => {
    if (isEligibleProfile(p)) return true;
    console.log(`skipped ${at(p.handle)}: no voice spec and no content pillars`);
    totals.skipped++;
    return false;
  });

  const inserts = new Map<string, { handle: string; rows: DraftInsert[] }>();
  for (const p of profiles) {
    try {
      await processProfile(sb, p, args, totals, inserts);
    } catch (e) {
      totals.failed++;
      console.error(`nightly FAILED: ${at(p.handle)}:`, e instanceof Error ? e.message : e);
    }
  }

  if (!args.dryRun && inserts.size > 0) {
    const deps = buildNotifyDeps(sb);
    for (const [profileId, { handle, rows }] of inserts) {
      try {
        await notify(
          profileId,
          {
            title: "Fila pronta",
            body: `A tua fila está pronta: ${rows.length} draft${rows.length === 1 ? "" : "s"} para ${at(handle)}`,
            url: "/",
          },
          deps,
        );
      } catch (e) {
        console.error(`notify FAILED: ${at(handle)}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  console.log(
    JSON.stringify({
      profiles: profiles.length,
      inserted: totals.inserted,
      skipped: totals.skipped,
      failed: totals.failed,
      estimatedXaiCostUsd: Number(estimateXaiCostUsd(totals.xaiPosts).toFixed(4)),
    }),
  );
  // Every eligible profile failed = job failure; partial success keeps the green.
  if (profiles.length > 0 && totals.failed === profiles.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
