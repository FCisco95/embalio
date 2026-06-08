"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { pickAssignment, type DailyAssignment } from "@/lib/coach/assignment";
import { findHotTopics } from "@/server/create-post";
import { gateTrends } from "@/server/credibility";
import type { GrowthPlan } from "@/lib/schemas";

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Pull a reply count out of the growth plan's rhythm lines (e.g. "5" / "5-20"); default 5. */
function replyQuotaFromPlan(plan: GrowthPlan | null): number {
  if (!plan?.rhythm?.length) return 5;
  const replyLine = plan.rhythm.find((r) => /repl/i.test(r.label));
  const src = replyLine ?? plan.rhythm[0];
  const m = String(src.count).match(/\d+/);
  return m ? parseInt(m[0], 10) : 5;
}

export async function getDailyAssignment(profileId: string): Promise<DailyAssignment> {
  const sb = await supabaseServer();

  const { data: posts } = await sb
    .from("posts")
    .select("posted_at, drafts(kind)")
    .eq("profile_id", profileId)
    .order("posted_at", { ascending: false })
    .limit(50);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postRows = (posts ?? []) as Array<Record<string, any>>;
  const todays = postRows.filter((p) => isToday(p.posted_at));
  const postedToday = todays.some((p) => {
    // Posts are always created from a draft; a missing draft relation is treated
    // as an original (the conservative default — counts as "posted today").
    const kind = (p.drafts?.kind as string) ?? "original";
    return kind === "original" || kind === "thread";
  });
  const repliesDoneToday = todays.filter((p) => (p.drafts?.kind as string) === "reply").length;

  const { data: cands } = await sb
    .from("candidates")
    .select("status")
    .eq("profile_id", profileId)
    .eq("status", "surfaced");
  const surfacedCandidates = (cands ?? []).length;

  const { data: profile } = await sb.from("profiles").select("growth_plan").eq("id", profileId).single();
  const plan = (profile?.growth_plan ?? null) as GrowthPlan | null;
  const replyQuota = replyQuotaFromPlan(plan);

  let topAngle: { hook: string; source?: string } | null = null;
  if (!postedToday) {
    try {
      const trends = await findHotTopics(profileId);
      const gated = await gateTrends(profileId, trends);
      if (gated[0]) topAngle = { hook: gated[0].angle, source: gated[0].trend.source };
    } catch {
      topAngle = null;
    }
  }

  return pickAssignment({ postedToday, repliesDoneToday, replyQuota, surfacedCandidates, topAngle });
}
