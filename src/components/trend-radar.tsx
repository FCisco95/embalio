"use client";
import { useState } from "react";
import { generateTrendRadar } from "@/server/trends";
import type { TrendReport } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";

function TrendCard({ topic, why_now, angle, source }: {
  topic: string; why_now: string; angle: string; source?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14px]">{topic}</span>
          <Badge variant="accent">trending</Badge>
        </div>
        <p className="text-[13px]">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Why now: </span>
          {why_now}
        </p>
        <p className="text-[13.5px]">
          <span className="text-muted-foreground font-medium">Angle: </span>
          {angle}
        </p>
        {source && (
          <a href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-text underline underline-offset-2">
            source →
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export function TrendRadarPanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [report, setReport] = useState<TrendReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await generateTrendRadar(profileId);
      setReport(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
        </StyledSelect>
        <Button disabled={busy || !profileId} onClick={run}>
          {busy ? "Scanning trends…" : "Scan niche trends"}
        </Button>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      {report && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">{report.generatedAt} · {report.trends.length} trends</p>
          {report.trends.map((t, i) => (
            <TrendCard key={i} {...t} />
          ))}
        </div>
      )}
    </div>
  );
}
