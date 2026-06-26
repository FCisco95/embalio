import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listProfiles } from "@/server/profiles";
import { getGateScorecard, listRecentActedAlerts } from "@/server/gate";
import { PageShell } from "@/components/shell/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReplyOutcomeList } from "@/components/gate/reply-outcome-list";
import { pct, signedPct } from "@/lib/gate/present";
import { cn } from "@/lib/utils";

function Metric({
  label,
  value,
  sub,
  ok,
}: {
  label: string;
  value: string;
  sub: string;
  ok?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-[22px] font-bold tabular-nums tracking-[-0.02em]",
          ok === true && "text-emerald-600 dark:text-emerald-400",
          ok === false && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

export default async function Gate2Page({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  const { profile } = await searchParams;
  const profiles = (await listProfiles()) ?? [];
  const active = profile ?? profiles[0]?.id;

  if (!active) {
    return (
      <PageShell title="GATE-2 scorecard" subtitle="Is the sniper measurably moving reach?">
        <div className="text-[13px] text-muted-foreground">No profile configured yet.</div>
      </PageShell>
    );
  }

  const gate = await getGateScorecard(active);
  const acted = await listRecentActedAlerts(active);

  return (
    <PageShell
      title="GATE-2 scorecard"
      subtitle="Is the sniper measurably moving reach? Manual outcomes only — no scrape."
    >
      <div className="max-w-2xl space-y-6">
        <Link
          href="/performance"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.6} /> Back to Stats
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Verdict {gate.pass.overall ? "✅ PASS" : "— in progress"}</CardTitle>
            <p className="text-[12px] text-muted-foreground">
              Window: last {gate.windowDays}d
              {gate.dataThrough ? ` · analytics through ${gate.dataThrough}` : " · no analytics imported yet"}
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metric
              label="Sniper precision (≥70%)"
              value={pct(gate.precision)}
              sub={`${gate.acted} acted / ${gate.dismissed} skipped`}
              ok={gate.pass.precision}
            />
            <Metric
              label="Reply-day visit lift (≥+25%)"
              value={signedPct(gate.replyDayVisitLift)}
              sub={`${gate.replyDays} reply day(s)`}
              ok={gate.pass.visitLift}
            />
            <Metric
              label="Cleared 2× reach (≥3)"
              value={`${gate.cleared2xCount}`}
              sub={`of ${gate.cleared2xN} recorded`}
              ok={gate.pass.cleared2x}
            />
            <Metric
              label="Author reply-back rate"
              value={pct(gate.authorReplyBackRate)}
              sub={`${gate.authorReplyBackN} recorded`}
            />
            <Metric label="False-alert rate" value={pct(gate.falseAlertRate)} sub={`${gate.dismissed} skipped`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skip reasons</CardTitle>
            <p className="text-[12px] text-muted-foreground">
              Why alerts were dismissed — tune the watch list + scorer.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] tabular-nums">
            {Object.entries(gate.skipBreakdown).map(([reason, n]) => (
              <span key={reason}>
                <span className="text-muted-foreground">{reason.replace(/_/g, " ")}:</span> {n}
              </span>
            ))}
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-[13px] font-semibold">Record reply outcomes</h3>
          <ReplyOutcomeList profileId={active} alerts={acted} />
        </div>
      </div>
    </PageShell>
  );
}
