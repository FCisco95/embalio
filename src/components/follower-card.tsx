import { Star, ArrowUp, ArrowDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkline } from "@/components/charts/sparkline"
import { formatCount } from "@/lib/format"
import { formatDelta } from "@/lib/kpis/present"
import type { FollowerStat } from "@/lib/kpis/aggregate"

/** Home star card: current followers + 7d delta + snapshot sparkline. */
export function FollowerCard({ stat }: { stat: FollowerStat | null }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <Star className="size-3.5 text-warning" strokeWidth={1.8} aria-hidden="true" />
          Followers
        </span>
        {stat ? (
          <>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-[26px] font-bold tabular-nums tracking-[-0.02em]" data-testid="follower-count">
                {formatCount(stat.followers)}
              </span>
              {stat.delta7d !== null && (
                <Badge variant={stat.delta7d >= 0 ? "good" : "bad"}>
                  {stat.delta7d >= 0 ? <ArrowUp strokeWidth={2} aria-hidden="true" /> : <ArrowDown strokeWidth={2} aria-hidden="true" />}
                  {formatDelta(stat.delta7d)} this week
                </Badge>
              )}
            </div>
            {stat.series.length >= 2 && (
              <Sparkline data={stat.series.map((s) => s.followers)} width={120} height={28} gradientId="spark-home-followers" />
            )}
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            No follower data yet — the daily snapshot cron fills this in.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
