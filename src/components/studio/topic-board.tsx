"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScorePill } from "@/components/ui/score-bar";
import { toast } from "sonner";
import { rankTopicsForProject, chooseTopic } from "@/server/studio/projects";
import type { RankedTopic } from "@/lib/studio/schemas";

export function TopicBoard({ profileId, projectId, onChosen }: { profileId: string; projectId: string; onChosen: () => void }) {
  const [topics, setTopics] = useState<RankedTopic[] | null>(null);
  const [scanning, startScan] = useTransition();
  const [picking, startPick] = useTransition();

  function scan() {
    startScan(async () => {
      try { setTopics(await rankTopicsForProject(profileId)); }
      catch (e) { toast.error(String(e)); }
    });
  }
  function pick(t: RankedTopic) {
    startPick(async () => {
      try { await chooseTopic(projectId, t); toast.success("Topic locked"); onChosen(); }
      catch (e) { toast.error(String(e)); }
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={scan} disabled={scanning || !profileId}>
        {scanning ? "Scanning what's trending…" : "Scan trending topics"}
      </Button>
      {topics?.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex flex-col gap-2 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[14px] font-semibold">{t.title}</div>
              <ScorePill value={t.score} />
            </div>
            <div className="text-[13px]">{t.angle}</div>
            <div className="text-[12px] text-muted-foreground">{t.rationale}</div>
            <div><Button size="sm" disabled={picking} onClick={() => pick(t)}>Pick this</Button></div>
          </CardContent>
        </Card>
      ))}
      {topics && topics.length === 0 && <p className="text-[13px] text-muted-foreground">No topics ranked — try again.</p>}
    </div>
  );
}
