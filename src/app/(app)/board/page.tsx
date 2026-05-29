import { PageShell } from "@/components/shell/page-shell"
import { listProfiles } from "@/server/profiles"
import { supabaseService } from "@/lib/supabase/server"
import { RefreshButton } from "@/components/refresh-button"
import { CandidateCard } from "@/components/candidate-card"

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>
}) {
  const { profile } = await searchParams
  const profiles = (await listProfiles()) ?? []
  const active = profile ?? profiles[0]?.id

  const postingEnabled = process.env.NEXT_PUBLIC_POSTING_ENABLED === "true"
  let candidates: Record<string, unknown>[] = []
  if (active) {
    const sb = supabaseService()
    const { data } = await sb
      .from("candidates")
      .select("*, drafts(*)")
      .eq("profile_id", active)
      .eq("status", "surfaced")
      .order("score_composite", { ascending: false })
    candidates = (data as Record<string, unknown>[]) ?? []
  }

  return (
    <PageShell
      title="Targeting Board"
      actions={active ? <RefreshButton profileId={active} /> : undefined}
    >
      <div className="flex gap-2 text-sm mb-4">
        {profiles.map((p) => (
          <a
            key={p.id}
            href={`/board?profile=${p.id}`}
            className={p.id === active ? "font-semibold underline" : "underline"}
          >
            {p.handle}
          </a>
        ))}
      </div>
      <div className="grid gap-3">
        {candidates.map((c) => (
          <CandidateCard
            key={c.id as string}
            candidate={c}
            postingEnabled={postingEnabled}
          />
        ))}
        {candidates.length === 0 && (
          <p className="text-muted-foreground">No targets yet — hit Refresh.</p>
        )}
      </div>
    </PageShell>
  )
}
