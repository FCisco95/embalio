import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pct, signedPct, passChip } from "@/lib/gate/present";
import type { GateScorecardResult } from "@/server/gate";

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[20px] font-bold tabular-nums tracking-[-0.02em]">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Chip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", passChip(ok).className)}>
      {label}
    </span>
  );
}

/** Compact GATE-2 verdict card on /performance — taps through to the full scorecard. */
export function GateScorecardCard({ gate }: { gate: GateScorecardResult }) {
  return (
    <Link href="/performance/gate-2" className="block">
      <Card interactive>
        <CardContent className="flex flex-col gap-2.5 pt-5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">GATE-2 dogfood scorecard</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                gate.pass.overall
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
              )}
            >
              {gate.pass.overall ? "PASS" : "in progress"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <Metric label="Precision" value={pct(gate.precision)} sub={`${gate.acted}/${gate.decided} acted`} />
            <Metric label="Reply-day reach" value={signedPct(gate.replyDayVisitLift)} sub="visit lift" />
            <Metric label="Cleared 2×" value={`${gate.cleared2xCount}`} sub={`need ${gate.thresholds.cleared2x}`} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip label="precision ≥70%" ok={gate.pass.precision} />
            <Chip label="≥3 cleared 2×" ok={gate.pass.cleared2x} />
            <Chip label="reach +≥25%" ok={gate.pass.visitLift} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
