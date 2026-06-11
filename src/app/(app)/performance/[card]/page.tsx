import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listProfiles } from "@/server/profiles";
import { getKpis } from "@/server/kpis";
import { PageShell } from "@/components/shell/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart } from "@/components/charts/area-chart";
import type { KpiSummary } from "@/lib/kpis/schemas";

const CARDS: Record<
  string,
  {
    title: string;
    subtitle: string;
    series: (k: KpiSummary) => { date: string; value: number }[];
    format: (v: number) => string;
    /** AreaChart y value (rate is charted as a percent number). */
    chartY: (v: number) => number;
    chartUnit?: string;
  }
> = {
  "follow-rate": {
    title: "Follow rate",
    subtitle: "New follows ÷ profile visits per day — 3–8% is healthy.",
    series: (k) => k.rateSeries,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    chartY: (v) => Math.round(v * 1000) / 10,
    chartUnit: "%",
  },
  follows: {
    title: "New follows",
    subtitle: "Daily new follows from the X analytics CSV.",
    series: (k) => k.followsSeries,
    format: (v) => String(v),
    chartY: (v) => v,
  },
  visits: {
    title: "Profile visits",
    subtitle: "Daily profile visits from the X analytics CSV.",
    series: (k) => k.visitsSeries,
    format: (v) => String(v),
    chartY: (v) => v,
  },
  followers: {
    title: "Followers",
    subtitle: "Daily follower snapshots (scraped, one per day).",
    series: (k) => k.followerSeries.map((p) => ({ date: p.date, value: p.followers })),
    format: (v) => v.toLocaleString(),
    chartY: (v) => v,
  },
};

export default async function KpiDrilldownPage({ params }: { params: Promise<{ card: string }> }) {
  const { card } = await params;
  if (!Object.hasOwn(CARDS, card)) return notFound();
  const def = CARDS[card];
  const profiles = (await listProfiles()) ?? [];
  const profileId = profiles[0]?.id;
  const kpis = profileId ? await getKpis(profileId) : null;
  const series = kpis ? def.series(kpis) : [];
  const chartData = series.map((p) => ({ x: p.date.slice(5), y: def.chartY(p.value) }));

  return (
    <PageShell title={def.title} subtitle={def.subtitle}>
      <div className="max-w-2xl space-y-6">
        <Link
          href="/performance"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.6} />
          Back to Stats
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{`Last 14 days${def.chartUnit ? ` (${def.chartUnit})` : ""}`}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length >= 2 ? (
              <AreaChart data={chartData} height={180} />
            ) : (
              <div className="py-8 text-center text-[13px] text-muted-foreground">
                Not enough data yet — import an analytics CSV on the Stats page.
              </div>
            )}
          </CardContent>
        </Card>

        {series.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">{def.title}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...series].reverse().map((p) => (
                    <TableRow key={p.date}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="text-right tabular-nums">{def.format(p.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
