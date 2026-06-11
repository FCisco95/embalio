import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import { cn } from "@/lib/utils";
import { formatRate, formatPerDay, formatDelta, bandChip } from "@/lib/kpis/present";
import type { KpiSummary } from "@/lib/kpis/schemas";

function KpiCard({
  href,
  label,
  value,
  chip,
  spark,
}: {
  href: string;
  label: string;
  value: string;
  chip?: { text: string; className: string } | null;
  spark?: number[];
}) {
  return (
    <Link href={href} className="block">
      <Card interactive>
        <CardContent className="flex flex-col gap-1.5 pt-5">
          <span className="text-[12px] text-muted-foreground">{label}</span>
          <span className="text-[26px] font-bold tabular-nums tracking-[-0.02em]">{value}</span>
          <div className="flex min-h-5 items-center justify-between gap-2">
            {chip ? (
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", chip.className)}>
                {chip.text}
              </span>
            ) : (
              <span />
            )}
            {spark && spark.length >= 2 && <Sparkline data={spark} width={72} height={22} />}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Mobile-first KPI card grid — every card taps through to /performance/[card]. */
export function KpiGrid({ kpis }: { kpis: KpiSummary }) {
  return (
    <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
      <KpiCard
        href="/performance/follow-rate"
        label="Follow rate (7d)"
        value={formatRate(kpis.followRate7d)}
        chip={bandChip(kpis.followRateBand)}
        spark={kpis.rateSeries.map((p) => p.value)}
      />
      <KpiCard
        href="/performance/follows"
        label="Follows / day (7d)"
        value={formatPerDay(kpis.followsPerDay7d)}
        spark={kpis.followsSeries.map((p) => p.value)}
      />
      <KpiCard
        href="/performance/visits"
        label="Profile visits / day (7d)"
        value={formatPerDay(kpis.visitsPerDay7d)}
        spark={kpis.visitsSeries.map((p) => p.value)}
      />
      <KpiCard
        href="/performance/followers"
        label="Followers"
        value={kpis.followerCount === null ? "—" : kpis.followerCount.toLocaleString()}
        chip={
          kpis.followerDelta7d === null
            ? null
            : {
                text: `${formatDelta(kpis.followerDelta7d)} this week`,
                className:
                  kpis.followerDelta7d >= 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
              }
        }
        spark={kpis.followerSeries.map((p) => p.followers)}
      />
    </div>
  );
}
