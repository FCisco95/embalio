import { supabaseService } from "@/lib/supabase/server";
import { getSignalSource } from "@/lib/signals";
import { warehouseTweets } from "@/lib/signals/warehouse";
import { embedText, embedTexts, relevanceFromVectors } from "@/lib/embeddings";
import { targetScore, type TargetScoreParts } from "@/lib/sniper/score";
import { baitScore } from "@/lib/engagement/bait";
import { knobsFromProfile } from "@/lib/engagement/knobs";
import { notify } from "@/lib/notify";
import { buildNotifyDeps } from "./notify-deps";
import { logActivity } from "@/lib/activity";
import { freshnessLabel } from "@/lib/engagement/present";
import { revalidatePath } from "next/cache";
import type { CandidateInput } from "@/lib/apify";
import type { Json } from "@/lib/supabase/types";
import { draftReply } from "@/lib/drafting";
import { buildReplyIntentUrl, buildStatusUrl } from "@/lib/send/intent";
import type { TelegramButton } from "@/lib/telegram";

const MAX_PER_HANDLE = 3;        // lean pull — owner-locked 15-min cadence budget
const MAX_WATCH_HANDLES = 10;    // spec: 5-10 priority handles (paid-tier lever later)
const ALERT_CAP_PER_POLL = 3;    // don't machine-gun the phone
const FRESH_WINDOW_MIN = 180;    // playbook: >3h is dead for first-to-comment

export type SniperCandidate = CandidateInput;

export interface PickedAlert {
  source_tweet_id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  score: number;
  parts: TargetScoreParts;
  /** Ms from tweet.createdAt to this poll's nowMs — tweet age at DISCOVERY, not end-to-end delivery latency. */
  latencyMs: number;
  ageMinutes: number;
  replies: number;
}

/** Pure decision core: score fresh candidates, drop hard-drops, threshold, cap. */
export function pickAlerts(
  cands: SniperCandidate[],
  relevanceOf: (c: SniperCandidate) => number,
  ownerFollowers: number,
  minScore: number,
  cap: number,
  nowMs: number,
): PickedAlert[] {
  const picked: PickedAlert[] = [];
  for (const c of cands) {
    const createdMs = new Date(c.metrics_snapshot.createdAt).getTime();
    if (Number.isNaN(createdMs)) continue;
    const ageMinutes = Math.max(0, (nowMs - createdMs) / 60_000);
    if (ageMinutes > FRESH_WINDOW_MIN) continue; // cheap pre-filter (stale-but-hot is the scan's job, not the sniper's)
    const repliesPerHour = c.metrics_snapshot.replies / Math.max(1 / 60, ageMinutes / 60);
    const r = targetScore({
      relevance: relevanceOf(c),
      ageMinutes,
      replyCount: c.metrics_snapshot.replies,
      repliesPerHour,
      authorFollowers: c.metrics_snapshot.authorFollowers,
      ownerFollowers,
      bait: baitScore(c.tweet_text),
    });
    if (r.drop || r.score < minScore) continue;
    picked.push({
      source_tweet_id: c.source_tweet_id,
      author_handle: c.author_handle,
      tweet_text: c.tweet_text,
      tweet_url: c.tweet_url,
      score: r.score,
      parts: r.parts,
      latencyMs: Math.round(nowMs - createdMs),
      ageMinutes: Math.round(ageMinutes),
      replies: c.metrics_snapshot.replies,
    });
  }
  return picked.sort((a, b) => b.score - a.score).slice(0, cap);
}

function alertTelegramText(a: PickedAlert, draft: string | null): string {
  const body = a.tweet_text.length > 220 ? `${a.tweet_text.slice(0, 220)}…` : a.tweet_text;
  const lines = [
    `🎯 Sniper: @${a.author_handle} — ${a.ageMinutes}m old · ${a.replies} replies · score ${Math.round(a.score * 100)}`,
    body,
  ];
  if (draft) lines.push(`\n✍️ Draft: ${draft}`);
  return lines.join("\n");
}

function alertButtons(a: PickedAlert, draft: string | null): TelegramButton[][] {
  // Primary action is the one-tap reply-intent (flagged); fallback is the status URL.
  const replyUrl =
    draft && process.env.REPLY_INTENT_ENABLED === "1"
      ? buildReplyIntentUrl(a.source_tweet_id, a.author_handle, draft)
      : buildStatusUrl(a.author_handle, a.source_tweet_id);
  const rows: TelegramButton[][] = [[{ text: "Open & reply ↗", url: replyUrl }]];
  if (draft && draft.length <= 256) rows.push([{ text: "📋 Copy draft", copyText: draft }]);
  rows.push([
    { text: "✅ Sent", data: `alert:sent:${a.source_tweet_id}` },
    { text: "⏭️ Skip", data: `alert:skip:${a.source_tweet_id}` },
  ]);
  return rows;
}

/**
 * One poll for one profile. Cloud-safe (signal source + embeddings + pure
 * scoring). Each alert's reply is drafted best-effort via GEN_BACKEND; a
 * drafting failure never drops the alert. Returns counts for the cron response.
 */
export async function runSniperPoll(profileId: string): Promise<{ pulled: number; alerts: number }> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  if (!profile) return { pulled: 0, alerts: 0 };

  const { data: targets } = await sb
    .from("watch_targets")
    .select("handle")
    .eq("profile_id", profileId)
    .eq("active", true)
    .order("priority", { ascending: false })
    .limit(MAX_WATCH_HANDLES);
  const handles = (targets ?? []).map((t) => t.handle).filter(Boolean);
  if (handles.length === 0) return { pulled: 0, alerts: 0 };

  const source = getSignalSource();
  const raw = await source.pullAuthorTweets(handles, { maxPerHandle: MAX_PER_HANDLE });
  await warehouseTweets(sb, source.id, raw); // dataset is the asset — warehouse everything

  const now = Date.now();
  const fresh = raw.filter(
    (r) =>
      r.tweet_text.trim().length > 0 &&
      now - new Date(r.metrics_snapshot.createdAt).getTime() <= FRESH_WINDOW_MIN * 60_000,
  );
  if (fresh.length === 0) return { pulled: raw.length, alerts: 0 };

  // Skip anything already alerted (idempotency pre-check; the unique constraint
  // is the backstop against poll races).
  const { data: existing } = await sb
    .from("sniper_alerts")
    .select("source_tweet_id")
    .eq("profile_id", profileId)
    .in("source_tweet_id", fresh.map((f) => f.source_tweet_id));
  const seen = new Set((existing ?? []).map((e) => e.source_tweet_id));
  const candidates = fresh.filter((f) => !seen.has(f.source_tweet_id));
  if (candidates.length === 0) return { pulled: raw.length, alerts: 0 };

  const voiceVec = await embedText(
    [profile.niche_description, ...((profile.content_pillars ?? []) as string[]), ...profile.voice_corpus]
      .filter(Boolean)
      .join(" "),
  );
  const tweetVecs = await embedTexts(candidates.map((c) => c.tweet_text));
  const relevanceById = new Map(
    candidates.map((c, i) => [c.source_tweet_id, relevanceFromVectors(voiceVec, tweetVecs[i])]),
  );

  // Real follower count beats the bucket estimate when we have it.
  const { data: snap } = await sb
    .from("follower_snapshots")
    .select("followers")
    .eq("profile_id", profileId)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const ownerFollowers = snap?.[0]?.followers ?? knobsFromProfile(profile).ownerFollowerEstimate;

  const minScore = Number(process.env.SNIPER_MIN_SCORE ?? "0.6");
  const picked = pickAlerts(
    candidates,
    (c) => relevanceById.get(c.source_tweet_id) ?? 0,
    ownerFollowers,
    minScore,
    ALERT_CAP_PER_POLL,
    now,
  );

  let alerts = 0;
  for (const a of picked) {
    let draft: string | null = null;
    try {
      const d = await draftReply(profile, a.tweet_text);
      draft = d.body?.trim() || null;
    } catch (err) {
      console.error("[sniper] draft failed (alert still sent):", String(err).slice(0, 160));
    }

    const { data: inserted, error } = await sb
      .from("sniper_alerts")
      .upsert(
        {
          profile_id: profileId,
          source_tweet_id: a.source_tweet_id,
          author_handle: a.author_handle,
          tweet_text: a.tweet_text,
          tweet_url: a.tweet_url,
          score: a.score,
          score_parts: a.parts as unknown as Json,
          latency_ms: a.latencyMs,
          draft_reply: draft,
        },
        { onConflict: "profile_id,source_tweet_id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) {
      console.error("[sniper] alert insert failed:", error.message);
      continue;
    }
    if (!inserted || inserted.length === 0) continue; // raced — another poll already alerted

    const result = await notify(
      profileId,
      {
        title: `🎯 @${a.author_handle} just posted`,
        body: a.tweet_text.slice(0, 140),
        url: "/engage",
        telegramText: alertTelegramText(a, draft),
        telegramButtons: alertButtons(a, draft),
      },
      buildNotifyDeps(sb),
    );
    await sb
      .from("sniper_alerts")
      .update({ channels: result as unknown as Json })
      .eq("id", inserted[0].id);
    await logActivity(sb, profileId, "sniper_alert_sent", {
      refId: a.source_tweet_id,
      meta: { score: a.score, latency_ms: a.latencyMs, channels: result },
    });
    alerts++;
  }
  return { pulled: raw.length, alerts };
}

/** Cron entry: poll every profile that has an active watch list. */
export async function runSniperPollAll(): Promise<{ profiles: number; pulled: number; alerts: number }> {
  const sb = supabaseService();
  const { data } = await sb.from("watch_targets").select("profile_id").eq("active", true);
  const profileIds = [...new Set((data ?? []).map((r) => r.profile_id))];
  let pulled = 0;
  let alerts = 0;
  for (const id of profileIds) {
    try {
      const r = await runSniperPoll(id);
      pulled += r.pulled;
      alerts += r.alerts;
    } catch (err) {
      console.error(`[sniper] poll failed for profile ${id}:`, String(err).slice(0, 200));
    }
  }
  return { profiles: profileIds.length, pulled, alerts };
}

const PIN_WINDOW_H = 3; // pins expire with the first-to-comment window

export interface SniperPin {
  alertId: string;
  authorHandle: string;
  text: string;
  url: string;
  score: number;     // 0-100
  freshness: string;
  latencyMin: number; // detection latency — the paid-tier baseline, surfaced honestly
}

export interface SniperAlertRowLite {
  id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  score: number;
  latency_ms: number;
  created_at: string;
}

export function toSniperPin(row: SniperAlertRowLite, nowMs: number): SniperPin {
  return {
    alertId: row.id,
    authorHandle: row.author_handle,
    text: row.tweet_text,
    url: row.tweet_url,
    score: Math.round(row.score * 100),
    freshness: freshnessLabel(row.created_at, nowMs),
    latencyMin: Math.round(row.latency_ms / 60_000),
  };
}

/** Active (un-acted, in-window) sniper alerts, hottest first — pinned on /engage. */
export async function getSniperPins(profileId: string): Promise<SniperPin[]> {
  const sb = supabaseService();
  const cutoff = new Date(Date.now() - PIN_WINDOW_H * 3600_000).toISOString();
  const { data } = await sb
    .from("sniper_alerts")
    .select("id, author_handle, tweet_text, tweet_url, score, latency_ms, created_at")
    .eq("profile_id", profileId)
    .eq("status", "sent")
    .gte("created_at", cutoff)
    .order("score", { ascending: false })
    .limit(5);
  const now = Date.now();
  return (data ?? []).map((row) => toSniperPin(row, now));
}

export async function markSniperAlert(
  profileId: string,
  alertId: string,
  action: "acted" | "dismissed",
): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb
    .from("sniper_alerts")
    .update({ status: action })
    .eq("id", alertId)
    .eq("profile_id", profileId);
  if (error) throw new Error(`marking sniper alert failed: ${error.message}`);
  if (action === "acted") {
    await logActivity(sb, profileId, "sniper_alert_acted", { refId: alertId });
  }
  revalidatePath("/engage");
}
