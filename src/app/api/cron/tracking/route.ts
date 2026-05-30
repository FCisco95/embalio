import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { makeApify, scrapeMetrics } from "@/lib/apify";
import type { Json } from "@/lib/supabase/types";

export const maxDuration = 300;
const MAX_POSTS_PER_RUN = 50;
const STALE_DAYS = 7;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET)
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
  const { data: posts } = await sb.from("posts")
    .select("id, tweet_url").gte("posted_at", cutoff)
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(MAX_POSTS_PER_RUN);
  let updated = 0;
  let failed = 0;
  for (const p of posts ?? []) {
    try {
      const m = await scrapeMetrics(makeApify(), process.env.APIFY_TWEET_SCRAPER_ACTOR!, p.tweet_url);
      await sb.from("posts").update({ metrics: m as unknown as Json, last_scraped_at: new Date().toISOString() }).eq("id", p.id);
      updated++;
    } catch (e) { failed++; console.error("tracking failed", p.id, e); }
  }
  // Surface a total outage as 500 so the cron is visibly failing, not silently 200.
  const attempted = updated + failed;
  const allFailed = attempted > 0 && updated === 0;
  return NextResponse.json({ ok: !allFailed, updated, failed }, { status: allFailed ? 500 : 200 });
}
