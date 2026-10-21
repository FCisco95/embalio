import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConsistencyResult } from "@/lib/gate/consistency";

/** 30-day consistency gate on /performance: days with a published post vs the target. */
export function ConsistencyGateCard({ gate }: { gate: ConsistencyResult }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-muted-foreground">Consistency gate</span>
          <span
            data-testid="consistency-status"
            data-passed={String(gate.passed)}
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              gate.passed
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
            )}
          >
            {gate.passed ? "PASS" : "in progress"}
          </span>
        </div>
        <div
          className={cn(
            "text-[20px] font-bold tabular-nums tracking-[-0.02em]",
            gate.passed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
          )}
        >
          {`${gate.publishDays} de ${gate.days} dias com post original publicado · meta ${gate.target}`}
        </div>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${gate.days}, minmax(0, 1fr))` }}>
          {gate.perDay.map((d) => (
            <div
              key={d.date}
              data-testid="day-cell"
              data-posted={String(d.posts > 0)}
              title={`${d.date}: ${d.posts} post${d.posts === 1 ? "" : "s"}`}
              className={cn(
                "h-5 rounded-[3px]",
                d.posts > 0
                  ? gate.passed
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                  : "bg-surface-2",
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
