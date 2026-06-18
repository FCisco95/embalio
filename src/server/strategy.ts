"use server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { embedTexts } from "@/lib/embeddings";
import { clusterPosition } from "@/lib/strategy/cluster";
import { replyFollowAttribution, buildReplyFollowPairs } from "@/lib/strategy/attribution";
import { shapeStrategyTargets, mergeApproachScan } from "@/lib/strategy/targets";
import { recommendAddsDrops } from "@/lib/strategy/recommend";
import { buildStrategySnapshot, weekOfUTC } from "@/lib/strategy/snapshot";
import { buildStrategySnapshotRecord } from "@/lib/strategy/persist";
import { recommendTargets } from "@/server/target-queue";
import { buildSeedScanPrompt } from "@/lib/voice-prompt";
import { generateText } from "@/lib/generate";
import { notify } from "@/lib/notify";
import { buildNotifyDeps } from "@/server/notify-deps";
import { revalidatePath } from "next/cache";
import type { EngagementTarget } from "@/lib/schemas";
import type { StrategySnapshot, StrategyTargets } from "@/lib/strategy/schemas";
import type { Json } from "@/lib/supabase/types";

export type StrategyBoardResult = { ok: true; snapshot: StrategySnapshot | null } | { ok: false; error: string };

export async function getStrategyBoard(profileId: string): Promise<StrategyBoardResult> {
  try {
    const sb = await supabaseServer();
    const { data } = await sb
      .from("strategy_snapshots").select("snapshot_json")
      .eq("profile_id", profileId).order("week_of", { ascending: false }).limit(1).maybeSingle();
    return { ok: true, snapshot: (data?.snapshot_json as StrategySnapshot) ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed to load strategy" };
  }
}

export type RunStrategyResult = { ok: true; weekOf: string; pushed: boolean } | { ok: false; error: string };

export async function runWeeklyStrategy(profileId: string, now = Date.now()): Promise<RunStrategyResult> {
  try {
    const sb = supabaseService();
    const weekOf = weekOfUTC(now);

    // profile (niche/pillars/north-star)
    const { data: profile } = await sb.from("profiles")
      .select("handle, niche_description, content_pillars, north_star_metric").eq("id", profileId).single();
    if (!profile) return { ok: false, error: "profile not found" };

    // active seeds
    const { data: seedRows } = await sb.from("seed_targets")
      .select("handle").eq("profile_id", profileId).eq("active", true);
    const activeSeedHandles = (seedRows ?? []).map((r) => r.handle).filter(Boolean) as string[];

    // niche material = recently surfaced candidate tweets + per-handle activity (drop signal)
    const { data: cands } = await sb.from("candidates")
      .select("author_handle, tweet_text").eq("profile_id", profileId)
      .order("pulled_at", { ascending: false }).limit(60);
    const nicheTexts = (cands ?? []).map((c) => c.tweet_text).filter(Boolean);
    const activityByHandle: Record<string, number> = {};
    for (const c of cands ?? []) activityByHandle[c.author_handle] = (activityByHandle[c.author_handle] ?? 0) + 1;

    // CLUSTER — embed account text + niche texts on demand (ephemeral)
    const accountText = `${profile.niche_description ?? ""} ${((profile.content_pillars as string[]) ?? []).join(" ")}`.trim();
    let cluster = clusterPosition({ accountVec: [], nicheVecs: [] });
    if (accountText && nicheTexts.length) {
      const vectors = await embedTexts([accountText, ...nicheTexts]);
      cluster = clusterPosition({ accountVec: vectors[0], nicheVecs: vectors.slice(1) });
    }

    // TARGETS — reuse recommendTargets; degrade to [] if the research call throws so cluster +
    // attribution + snapshot still persist (don't let a flaky LLM call discard the whole week).
    let recommended: EngagementTarget[] = [];
    try {
      const queue = await recommendTargets({
        existingHandles: activeSeedHandles,
        contentPillars: (profile.content_pillars as string[]) ?? [],
        northStarMetric: profile.north_star_metric ?? null,
      });
      recommended = queue.targets;
    } catch (e) {
      console.error("[strategy] recommendTargets failed; degrading to empty picks:", String(e).slice(0, 200));
    }
    const targets = shapeStrategyTargets(recommended, new Date(now).toISOString());
    // Approach enrichment via buildSeedScanPrompt runs post-persist (best-effort) — see below.

    // ATTRIBUTION — fetch rows; the pure pair-builder dedups multi-source days before diffing
    const { data: replyEvents } = await sb.from("activity_events")
      .select("created_at").eq("profile_id", profileId).eq("kind", "reply_posted");
    const { data: snaps } = await sb.from("follower_snapshots")
      .select("snapshot_date, captured_at, followers").eq("profile_id", profileId);
    const attribution = replyFollowAttribution(buildReplyFollowPairs(replyEvents ?? [], snaps ?? []));

    // RECOMMEND adds/drops (pure; human approves later)
    const recommendations = recommendAddsDrops({ picks: targets.picks, activeSeedHandles, activityByHandle });

    // SNAPSHOT + PERSIST base FIRST (idempotent upsert) — so a slow/failed seed-scan enrich
    // can never cost us the week's snapshot.
    const persist = async (t: StrategyTargets) => {
      const snapshot = buildStrategySnapshot({
        weekOf, cluster, targets: t, attribution, recommendations, generatedAt: new Date(now).toISOString(),
      });
      const rec = buildStrategySnapshotRecord(snapshot, profileId);
      await sb.from("strategy_snapshots").upsert(
        { profile_id: rec.profile_id, week_of: rec.week_of, snapshot_json: rec.snapshot_json as unknown as Json },
        { onConflict: "profile_id,week_of" },
      );
    };
    await persist(targets);

    // REVIEW PUSH via existing notify()
    const result = await notify(
      profileId,
      {
        title: "📊 Weekly strategy review",
        body: `${cluster.band} of niche · ${targets.picks.length} target picks · ${recommendations.adds.length} adds / ${recommendations.drops.length} drops`,
        url: "/board",
      },
      buildNotifyDeps(sb),
    );

    // APPROACH ENRICH (decision #1) — ONE batched buildSeedScanPrompt scan over the top picks'
    // handles → fold each handle's last-24h activity into suggested_approach → re-upsert.
    // Best-effort: the base snapshot already shipped, so a scan failure/timeout is non-fatal.
    try {
      if (targets.picks.length) {
        const handles = targets.picks.slice(0, 10).map((p) => p.handle);
        const dateStr = new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const scan = await generateText(buildSeedScanPrompt(handles, dateStr), { research: true });
        const scanByHandle: Record<string, string> = {};
        for (const p of targets.picks) {
          const needle = p.handle.toLowerCase().replace(/^@/, "");
          const line = scan.split("\n").find((l) => l.toLowerCase().includes(needle));
          if (line) scanByHandle[p.handle] = line.trim().slice(0, 160);
        }
        if (Object.keys(scanByHandle).length) {
          await persist({ ...targets, picks: mergeApproachScan(targets.picks, scanByHandle) });
        }
      }
    } catch (e) {
      console.error("[strategy] seed-scan enrich skipped:", String(e).slice(0, 200));
    }

    return { ok: true, weekOf, pushed: result.telegram === "sent" || result.push.sent > 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "weekly strategy failed" };
  }
}

export type ApplyResult = { ok: true; added: number; dropped: number } | { ok: false; error: string };

/** HUMAN-IN-THE-LOOP: mutates seed_targets ONLY for the explicit handles the user approved. Never auto-called. */
export async function applyTargetRecommendation(
  profileId: string,
  decision: { adds: string[]; drops: string[] },
): Promise<ApplyResult> {
  try {
    if (!decision.adds.length && !decision.drops.length) return { ok: false, error: "nothing to apply" };
    const sb = await supabaseServer();
    if (decision.adds.length) {
      await sb.from("seed_targets").upsert(
        decision.adds.map((handle) => ({ profile_id: profileId, handle, active: true })),
        { onConflict: "profile_id,handle" },
      );
    }
    if (decision.drops.length) {
      await sb.from("seed_targets").update({ active: false })
        .eq("profile_id", profileId).in("handle", decision.drops);
    }
    revalidatePath("/board");
    return { ok: true, added: decision.adds.length, dropped: decision.drops.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "apply failed" };
  }
}
