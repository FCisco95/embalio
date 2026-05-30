"use server";
import { supabaseServer } from "@/lib/supabase/server";

export interface DashboardData {
  reach: { total: number; delta: number | null; series: { x: string; y: number }[] };
  topPost: {
    body: string;
    likes: number;
    reposts: number;
    replies: number;
    views: number;
    er: number | null;
    when: string;
  } | null;
  strategy: { title: string; body: string; lift: string | null } | null;
  targets: { handle: string; text: string; score: number; when: string }[];
}

function engagement(m: Record<string, number> | null | undefined): number {
  if (!m) return 0;
  return (m.likes ?? 0) + (m.reposts ?? 0) + (m.replies ?? 0);
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Everything the command center shows, derived only from real DB rows.
 * Each field is null/empty when there's nothing real to show — the page
 * renders honest empty states rather than fabricated numbers.
 */
export async function getDashboardData(profileId: string): Promise<DashboardData> {
  const sb = await supabaseServer();

  const { data: posts } = await sb.from("posts")
    .select("tweet_url, posted_at, metrics, drafts(body, kind)")
    .eq("profile_id", profileId)
    .order("posted_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (posts ?? []) as Array<Record<string, any>>;

  // --- Reach hero: views over the last 7 days, vs the prior 7 ---
  const now = Date.now();
  const DAY = 86_400_000;
  const days: { x: string; y: number }[] = [];
  for (let i = 6; i >= 0; i--) days.push({ x: dayKey(new Date(now - i * DAY)), y: 0 });
  const idxByKey = new Map(days.map((d, i) => [d.x, i]));

  let thisWeek = 0;
  let priorWeek = 0;
  for (const p of rows) {
    const t = new Date(p.posted_at).getTime();
    const v = p.metrics?.views ?? 0;
    const age = now - t;
    if (age < 7 * DAY) {
      thisWeek += v;
      const i = idxByKey.get(dayKey(new Date(t)));
      if (i !== undefined) days[i].y += v;
    } else if (age < 14 * DAY) {
      priorWeek += v;
    }
  }
  const delta = priorWeek > 0 ? ((thisWeek - priorWeek) / priorWeek) * 100 : null;

  // --- Top post: highest engagement of all time ---
  let top: Record<string, unknown> | null = null;
  let topScore = -1;
  for (const p of rows) {
    const s = engagement(p.metrics);
    if (s > topScore) { topScore = s; top = p; }
  }
  const topPost = top && engagement(top.metrics as Record<string, number>) > 0
    ? (() => {
        const m = (top!.metrics ?? {}) as Record<string, number>;
        const views = m.views ?? 0;
        return {
          body: ((top!.drafts as { body?: string } | null)?.body ?? "").trim(),
          likes: m.likes ?? 0,
          reposts: m.reposts ?? 0,
          replies: m.replies ?? 0,
          views,
          er: views > 0 ? Math.round((engagement(m) / views) * 1000) / 10 : null,
          when: new Date(top!.posted_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
      })()
    : null;

  // --- Strategy of the week: data-derived, no AI ---
  const byKind: Record<string, { eng: number; n: number }> = {
    reply: { eng: 0, n: 0 }, original: { eng: 0, n: 0 },
  };
  for (const p of rows) {
    const kind = (p.drafts?.kind as string) ?? "original";
    if (!byKind[kind]) continue;
    byKind[kind].eng += engagement(p.metrics);
    byKind[kind].n += 1;
  }
  const avgReply = byKind.reply.n ? byKind.reply.eng / byKind.reply.n : 0;
  const avgOrig = byKind.original.n ? byKind.original.eng / byKind.original.n : 0;
  let strategy: DashboardData["strategy"] = null;
  if (byKind.reply.n && byKind.original.n && (avgReply > 0 || avgOrig > 0)) {
    const replyWins = avgReply >= avgOrig;
    const hi = replyWins ? avgReply : avgOrig;
    const lo = replyWins ? avgOrig : avgReply;
    const mult = lo > 0 ? Math.round((hi / lo) * 10) / 10 : null;
    strategy = {
      title: replyWins
        ? "Replies are outperforming your original posts"
        : "Original posts are outperforming your replies",
      body: replyWins
        ? "Your replies are pulling more engagement per post than your originals this week. Lean into the conversation."
        : "Your original posts are pulling more engagement per post than your replies this week. Keep shipping takes.",
      lift: mult ? `${mult}× engagement` : null,
    };
  }

  // --- Today's targets: real surfaced candidates by score ---
  const { data: cands } = await sb.from("candidates")
    .select("author_handle, tweet_text, score_composite, pulled_at")
    .eq("profile_id", profileId)
    .eq("status", "surfaced")
    .order("score_composite", { ascending: false })
    .limit(3);
  const targets = (cands ?? []).map((c) => ({
    handle: c.author_handle.startsWith("@") ? c.author_handle : `@${c.author_handle}`,
    text: c.tweet_text,
    score: Math.round((c.score_composite ?? 0) * 100),
    when: new Date(c.pulled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return {
    reach: { total: thisWeek, delta: delta === null ? null : Math.round(delta * 10) / 10, series: days },
    topPost,
    strategy,
    targets,
  };
}
