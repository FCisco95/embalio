import { listProfiles } from "@/server/profiles";
import { listPerformance } from "@/server/posts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shell/page-shell";
import { AreaChart } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";

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
      title="Reach"
      subtitle="Per-post performance across your connected platforms."
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

        {/* Posts table */}
        <Card>
          <CardHeader>
            <CardTitle>All posts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="tabular-nums">Likes</TableHead>
                  <TableHead className="tabular-nums">Views</TableHead>
                  <TableHead>Posted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => (
                  <TableRow key={p.id} className="hover:bg-surface-2">
                    <TableCell className="max-w-md">
                      <a
                        href={p.tweet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 text-brand-text truncate block"
                      >
                        {p.drafts?.body ?? p.tweet_url}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.drafts?.kind}</TableCell>
                    <TableCell className="tabular-nums">{p.metrics?.likes ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{p.metrics?.views ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.posted_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {posts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No posts tracked yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
