"use client";
import { useState, useTransition } from "react";
import { applyTargetRecommendation } from "@/server/strategy";
import type { StrategySnapshot } from "@/lib/strategy/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StrategyCardProps {
  snapshot: StrategySnapshot;
  profileId: string;
}

type ApproveState = "idle" | "pending" | "done" | "error";

function bandClass(band: "core" | "edge" | "outside"): string {
  if (band === "core") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
  if (band === "edge") return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

function priorityClass(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300";
  if (priority === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

function ApproveButton({ label, onApprove }: { label: string; onApprove: () => Promise<void> }) {
  const [state, setState] = useState<ApproveState>("idle");
  const [, startTransition] = useTransition();

  function handleClick() {
    if (state === "pending" || state === "done") return;
    setState("pending");
    startTransition(async () => {
      try {
        await onApprove();
        setState("done");
      } catch {
        setState("error");
      }
    });
  }

  const buttonLabel =
    state === "pending" ? "Approving…"
    : state === "done" ? "Approved ✓"
    : state === "error" ? "Failed — retry"
    : label;

  return (
    <Button
      size="sm"
      disabled={state === "pending" || state === "done"}
      onClick={handleClick}
    >
      {buttonLabel}
    </Button>
  );
}

export function StrategyCard({ snapshot, profileId }: StrategyCardProps) {
  const { cluster, targets, attribution, recommendations } = snapshot;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">

        {/* Cluster position */}
        <div className="flex flex-col gap-1">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
            Niche cluster
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold",
                bandClass(cluster.band)
              )}
            >
              {cluster.band}
            </span>
            <span className="text-[13px] font-medium">
              {Math.round(cluster.alignment * 100)}% alignment
            </span>
            <span className="text-[12px] text-muted-foreground">
              · {cluster.nicheSize} niche docs
            </span>
          </div>
        </div>

        {/* Target picks */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
            Target picks
          </h3>
          {targets.picks.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic">
              Thin data — keep building. Picks appear once you have 10–20 reply interactions.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {targets.picks.map((pick) => (
                <div
                  key={pick.handle}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[13px]">{pick.handle}</span>
                    <span
                      className={cn(
                        "inline-flex h-4 items-center rounded-full px-2 text-[10px] font-semibold",
                        priorityClass(pick.priority)
                      )}
                    >
                      {pick.priority}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{pick.reason}</p>
                  <p className="text-[12px]">
                    <span className="text-muted-foreground">→ </span>
                    {pick.suggested_approach}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attribution block */}
        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
            Reply-follow attribution
          </h3>
          {attribution.status === "insufficient_data" ? (
            <div className="flex flex-col gap-1">
              <p className="text-[12px] text-muted-foreground">
                {attribution.n} / {attribution.minN} interactions needed
              </p>
              <p className="text-[12px] text-muted-foreground italic">{attribution.message}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="inline-flex h-5 items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 px-2 text-[11px] font-semibold w-fit">
                r = {attribution.r.toFixed(2)} · n = {attribution.n}
              </span>
              <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400 mt-1">
                {attribution.disclaimer}
              </p>
            </div>
          )}
        </div>

        {/* Recommendations: adds */}
        {recommendations.adds.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
              Suggested adds
            </h3>
            {recommendations.adds.map((add) => (
              <div
                key={add.handle}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 flex items-start justify-between gap-3"
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[13px]">{add.handle}</span>
                    <span
                      className={cn(
                        "inline-flex h-4 items-center rounded-full px-2 text-[10px] font-semibold",
                        priorityClass(add.priority)
                      )}
                    >
                      {add.priority}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{add.reason}</p>
                  <p className="text-[12px]">
                    <span className="text-muted-foreground">→ </span>
                    {add.suggested_approach}
                  </p>
                </div>
                <ApproveButton
                  label="Approve"
                  onApprove={() =>
                    applyTargetRecommendation(profileId, { adds: [add.handle], drops: [] }).then(
                      (r) => { if (!r.ok) throw new Error(r.error); }
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Recommendations: drops */}
        {recommendations.drops.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
              Suggested drops
            </h3>
            {recommendations.drops.map((drop) => (
              <div
                key={drop.handle}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 flex items-start justify-between gap-3"
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="font-semibold text-[13px]">{drop.handle}</span>
                  <p className="text-[12px] text-muted-foreground">{drop.reason}</p>
                </div>
                <ApproveButton
                  label="Remove"
                  onApprove={() =>
                    applyTargetRecommendation(profileId, { adds: [], drops: [drop.handle] }).then(
                      (r) => { if (!r.ok) throw new Error(r.error); }
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
