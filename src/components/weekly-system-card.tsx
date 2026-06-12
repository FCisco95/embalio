"use client";
import { useState, useTransition } from "react";
import { LayoutGrid, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toggleProfileOptimized } from "@/server/profiles";
import type { WeeklyActivity } from "@/server/weekly-activity";

export const WEEKLY_POSTS_GOAL = 5;
export const WEEKLY_REPLIES_GOAL = 20;

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

function OptimizationChip({
  label,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        checked
          ? "border-success/40 bg-success/10 text-success"
          : "border-border text-muted-foreground hover:border-accent hover:text-foreground",
      )}
    >
      {checked ? (
        <CheckCircle2 className="size-3.5" strokeWidth={2} />
      ) : (
        <Circle className="size-3.5" strokeWidth={1.6} />
      )}
      {label}
    </button>
  );
}

export function WeeklySystemCard({
  data,
  profileId,
}: {
  data: WeeklyActivity;
  profileId: string;
}) {
  const [bioOptimized, setBioOptimized] = useState(data.bioOptimized);
  const [pinnedOptimized, setPinnedOptimized] = useState(data.pinnedOptimized);
  const [isPending, startTransition] = useTransition();

  function toggle(field: "bio_optimized" | "pinned_optimized") {
    if (field === "bio_optimized") {
      const prev = bioOptimized;
      const next = !prev;
      setBioOptimized(next);
      startTransition(async () => {
        try {
          await toggleProfileOptimized(profileId, field, next);
        } catch {
          setBioOptimized(prev);
        }
      });
    } else {
      const prev = pinnedOptimized;
      const next = !prev;
      setPinnedOptimized(next);
      startTransition(async () => {
        try {
          await toggleProfileOptimized(profileId, field, next);
        } catch {
          setPinnedOptimized(prev);
        }
      });
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <span className="mb-4 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <LayoutGrid className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          This week
        </span>

        <div className="flex flex-wrap gap-6">
          {/* Posts */}
          <div className="min-w-[80px] flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Posts
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span
                className="text-[22px] font-bold tabular-nums tracking-[-0.02em]"
                data-testid="weekly-posts"
              >
                {data.postsThisWeek}
              </span>
              <span className="text-[13px] text-muted-foreground">/ {WEEKLY_POSTS_GOAL}</span>
            </div>
            <ProgressBar value={data.postsThisWeek} max={WEEKLY_POSTS_GOAL} />
            {data.postsThisWeek === 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">Queue up your first post</p>
            )}
          </div>

          {/* Replies */}
          <div className="min-w-[80px] flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Replies
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span
                className="text-[22px] font-bold tabular-nums tracking-[-0.02em]"
                data-testid="weekly-replies"
              >
                {data.repliesThisWeek}
              </span>
              <span className="text-[13px] text-muted-foreground">/ {WEEKLY_REPLIES_GOAL}</span>
            </div>
            <ProgressBar value={data.repliesThisWeek} max={WEEKLY_REPLIES_GOAL} />
            {data.repliesThisWeek === 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Sniper has targets waiting
              </p>
            )}
          </div>

          {/* Profile checklist */}
          <div className="min-w-[120px] flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Profile
            </div>
            <div className="mt-1.5 flex flex-col gap-1.5">
              <OptimizationChip
                label="Bio has proof"
                checked={bioOptimized}
                disabled={isPending}
                onClick={() => toggle("bio_optimized")}
              />
              <OptimizationChip
                label="Pinned shows result"
                checked={pinnedOptimized}
                disabled={isPending}
                onClick={() => toggle("pinned_optimized")}
              />
            </div>
            {!bioOptimized || !pinnedOptimized ? (
              <p className="mt-2 text-[11px] text-muted-foreground">Tap to mark done</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
