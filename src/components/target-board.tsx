"use client";
import { useState } from "react";
import { generateTargetQueue } from "@/server/target-queue";
import type { TargetQueue } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { ScorePill, ScoreBar } from "@/components/ui/score-bar";
import { toast } from "sonner";

const PRIORITY_VARIANTS: Record<string, "good" | "warn" | "bad"> = {
  high: "good",
  medium: "warn",
  low: "bad",
};

const PRIORITY_SCORES: Record<string, number> = {
  high: 80,
  medium: 50,
  low: 25,
};

function TargetCard({ handle, reason, priority, suggested_approach }: {
  handle: string; reason: string; priority: string; suggested_approach: string;
}) {
  const score = PRIORITY_SCORES[priority] ?? 50;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14px]">
            {handle.startsWith("@") ? handle : `@${handle}`}
          </span>
          <Badge variant={PRIORITY_VARIANTS[priority] ?? "secondary"}>{priority}</Badge>
          <div className="flex items-center gap-2 ml-auto">
            <ScorePill value={score} />
            <ScoreBar value={score} />
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground">{reason}</p>
        <div className="bg-surface-2 rounded-[10px] p-3">
          <p className="text-[13px]">
            <span className="font-medium text-muted-foreground">Approach: </span>
            {suggested_approach}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TargetBoardPanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [queue, setQueue] = useState<TargetQueue | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await generateTargetQueue(profileId);
      setQueue(result);
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
          {busy ? "Finding targets…" : "Find who to engage"}
        </Button>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      {queue && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            {queue.generatedAt} · {queue.targets.length} targets
          </p>
          {queue.targets.length === 0 && (
            <p className="text-[13px] text-muted-foreground">No targets found — try updating your content pillars.</p>
          )}
          {queue.targets.map((t, i) => (
            <TargetCard key={i} {...t} />
          ))}
        </div>
      )}
    </div>
  );
}
