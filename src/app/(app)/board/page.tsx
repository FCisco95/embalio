import { listProfiles } from "@/server/profiles";
import { supabaseServer } from "@/lib/supabase/server";
import { RefreshButton } from "@/components/refresh-button";
import { CandidateCard } from "@/components/candidate-card";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  const { profile } = await searchParams;
  const profiles = (await listProfiles()) ?? [];
  const active = profile ?? profiles[0]?.id;

  let candidates: Record<string, unknown>[] = [];
  if (active) {
    const sb = await supabaseServer();
    const { data } = await sb.from("candidates")
      .select("*, drafts(*)").eq("profile_id", active).eq("status", "surfaced")
      .order("score_composite", { ascending: false });
    candidates = (data as Record<string, unknown>[]) ?? [];
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Targeting board</h1>
        {active && <RefreshButton profileId={active} />}
      </div>
      <div className="flex gap-2 text-sm">
        {profiles.map((p) => <a key={p.id} href={`/board?profile=${p.id}`} className={p.id === active ? "font-semibold underline" : "underline"}>{p.handle}</a>)}
      </div>
      <div className="grid gap-3">
        {candidates.map((c) => <CandidateCard key={c.id as string} candidate={c} />)}
        {candidates.length === 0 && <p className="text-muted-foreground">No targets yet — hit Refresh.</p>}
      </div>
    </div>
  );
}
