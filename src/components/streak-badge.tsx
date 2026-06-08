"use client";
import { useEffect } from "react";
import { Flame } from "lucide-react";
import { useReward } from "@/components/reward-burst";

const KEY = "embalio:lastStreak";

export function StreakBadge({ streak }: { streak: number }) {
  const { fire, burst } = useReward();
  useEffect(() => {
    const last = Number(localStorage.getItem(KEY) ?? "0");
    if (streak > last) fire();
    localStorage.setItem(KEY, String(streak));
  }, [streak, fire]);
  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold">
      <Flame className="size-4 text-warning" strokeWidth={1.8} />
      <span data-testid="streak-count">{streak}</span>
      <span className="text-muted-foreground font-normal">day{streak === 1 ? "" : "s"}</span>
      {burst}
    </span>
  );
}
