"use client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyWhatIf } from "@/lib/predict/whatif";
import { TrajectoryChart } from "./trajectory-chart";
import type { Trajectory, WeeklyForecast } from "@/lib/predict/schemas";

const SLIDERS = [
  { key: "engagementRate", label: "Engagement rate" },
  { key: "followConversion", label: "Follow conversion" },
  { key: "postFrequency", label: "Post frequency" },
] as const;

export function ForecastCard({ trajectory, forecast }: { trajectory: Trajectory | null; forecast: WeeklyForecast | null }) {
  const [knobs, setKnobs] = useState({ engagementRate: 1, followConversion: 1, postFrequency: 1 });
  const adjusted = useMemo(() => (trajectory ? applyWhatIf(trajectory, knobs) : null), [trajectory, knobs]);
  if (!trajectory) {
    return (
      <Card>
        <CardHeader><CardTitle>Forecast</CardTitle></CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">Need at least two follower snapshots to project a trajectory.</CardContent>
      </Card>
    );
  }
  const endValue = adjusted!.projected[adjusted!.projected.length - 1]?.followers ?? forecast?.predictedFollowers;
  return (
    <Card>
      <CardHeader><CardTitle>Forecast</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {forecast && (
          <div>
            <div className="text-[26px] font-bold tabular-nums tracking-[-0.02em]">{forecast.predictedFollowers.toLocaleString()}</div>
            <div className="text-[12px] text-muted-foreground">predicted by {forecast.predictedDate} · band {forecast.low.toLocaleString()}–{forecast.high.toLocaleString()}</div>
          </div>
        )}
        <TrajectoryChart trajectory={adjusted!} />
        <div className="space-y-3">
          {SLIDERS.map(({ key, label }) => (
            <label key={key} className="block text-[12px]">
              <span className="text-muted-foreground">{label}: {knobs[key].toFixed(2)}×</span>
              <input
                type="range" min={0.5} max={2} step={0.05} value={knobs[key]}
                onChange={(e) => setKnobs((k) => ({ ...k, [key]: Number(e.target.value) }))}
                className="w-full"
              />
            </label>
          ))}
          <div className="text-[13px]">What-if end of horizon: <span className="font-semibold tabular-nums">{endValue?.toLocaleString() ?? "—"}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
