import { listProfiles } from "@/server/profiles";
import { listPerformance } from "@/server/posts";
import { getKpis } from "@/server/kpis";
import { KpiGrid } from "@/components/kpis/kpi-grid";
import { CsvImportCard } from "@/components/kpis/csv-import-card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shell/page-shell";
import { AreaChart } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { MetricsRow } from "@/components/metrics-row";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile } = await searchParams;
  const profiles = (await listProfiles()) ?? [];
  const active = profile ?? profiles[0]?.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts: Array<Record<string, any>> = active
    ? ((await listPerformance(active)) ?? [])
    : [];
  const kpis = active ? await getKpis(active) : null;

  // Stat calculations
  const totalLikes = posts.reduce((s, p) => s + (p.metrics?.likes ?? 0), 0);
  const totalViews = posts.reduce((s, p) => s + (p.metrics?.views ?? 0), 0);
  const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : 0;

  // AreaChart: likes over time (sorted by posted_at)
  const timelineData = [...posts]
    .sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime())
    .map((p) => ({
      x: new Date(p.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      y: p.metrics?.likes ?? 0,
    }));

  // BarChart: posts per day of week
  const dayCounts = Array(7).fill(0) as number[];
  posts.forEach((p) => {
    const d = new Date(p.posted_at).getDay();
    dayCounts[d]++;
  });
  const weeklyData = DAY_LABELS.map((label, i) => ({ label, value: dayCounts[i] }));

  return (
    <PageShell
      title="Stats"
      subtitle="What actually moves the account — import your weekly X analytics CSV to feed the KPI cards."
    >
      <div className="space-y-6">
        {/* Profile filter */}
        <div className="flex gap-1 p-1 bg-surface-2 rounded-full w-fit">
          {profiles.map((p) => (
            <a
              key={p.id}
              href={`/performance?profile=${p.id}`}
              className={[
                "px-3 py-1 rounded-full text-[13px] font-medium transition-colors",
                p.id === active
                  ? "bg-card border border-border text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {p.handle}
            </a>
          ))}
        </div>

        {/* KPI cards — follow conversion north star (P3) */}
        {kpis && <KpiGrid kpis={kpis} />}
        {active && (
          <CsvImportCard
            profileId={active}
            dataThrough={kpis?.dataThrough ?? null}
            staleDays={kpis?.staleDays ?? null}
          />
        )}

        {/* Stat chips */}
        <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-4">
          {[
            { label: "Posts", value: posts.length },
            { label: "Total likes", value: totalLikes },
            { label: "Total views", value: totalViews },
            { label: "Avg likes", value: avgLikes },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <div className="text-[26px] font-bold tabular-nums tracking-[-0.02em]">
                  {value.toLocaleString()}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        {posts.length > 1 && (
          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Likes over time</CardTitle>
              </CardHeader>
              <CardContent>
                <AreaChart data={timelineData} height={180} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Posts by day</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={weeklyData} height={120} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Posts table — enter real metrics inline */}
        <Card>
          <CardHeader>
            <CardTitle>All posts</CardTitle>
            <p className="text-[12px] text-muted-foreground">
              Enter the real numbers from each post, then Save. These feed your dashboard.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {posts.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted-foreground">
                No posts tracked yet — mark a draft as posted to track it here.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Reposts</TableHead>
                    <TableHead className="text-right">Replies</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Save</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((p) => (
                    <MetricsRow
                      key={p.id}
                      postId={p.id}
                      body={p.drafts?.body ?? ""}
                      metrics={p.metrics ?? null}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
