import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { makeApify, scrapeMetrics } from "@/lib/apify";
import type { Json } from "@/lib/supabase/types";
import { cronAuthError } from "@/lib/cron-auth";
import { tweetIdFromUrl } from "@/lib/signals/tweet-id";

export const maxDuration = 300;
const MAX_POSTS_PER_RUN = 50;
const STALE_DAYS = 7;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const sb = supabaseService();
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
  const { data: posts } = await sb.from("posts")
    .select("id, tweet_url").gte("posted_at", cutoff)
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(MAX_POSTS_PER_RUN);
  let updated = 0;
  let failed = 0;
  for (const p of posts ?? []) {
    if (!p.tweet_url) continue; // URL-less quick-reply log (one-tap Done) — nothing to scrape
    try {
      const m = await scrapeMetrics(makeApify(), process.env.APIFY_TWEET_SCRAPER_ACTOR!, p.tweet_url);
      await sb.from("posts").update({ metrics: m as unknown as Json, last_scraped_at: new Date().toISOString() }).eq("id", p.id);
      // Own posts enter the warehouse minimal — a later KPI phase reads these first-hour snapshots.
      const tid = tweetIdFromUrl(p.tweet_url);
      if (tid) {
        const { data: st } = await sb.from("signal_tweets")
          .upsert({ source: "apify", source_tweet_id: tid, author_handle: "", url: p.tweet_url, last_seen_at: new Date().toISOString() }, { onConflict: "source_tweet_id" })
          .select("id").single();
        if (st) {
          const { error: snapErr } = await sb.from("tweet_metric_snapshots").insert({ signal_tweet_id: st.id, likes: m.likes, views: m.views, replies: m.replies });
          if (snapErr) console.error("tracking snapshot failed", p.id, snapErr.message);
        }
      }
      updated++;
    } catch (e) { failed++; console.error("tracking failed", p.id, e); }
  }
  // Surface a total outage as 500 so the cron is visibly failing, not silently 200.
  const attempted = updated + failed;
  const allFailed = attempted > 0 && updated === 0;
  return NextResponse.json({ ok: !allFailed, updated, failed }, { status: allFailed ? 500 : 200 });
}
