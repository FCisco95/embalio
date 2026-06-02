"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { writeScriptForProject, saveScript, advanceToRecord } from "@/server/studio/projects";
import type { VideoScript } from "@/lib/studio/schemas";

export function ScriptStudio({ projectId, script, onAdvance, onScript }: {
  projectId: string; script: unknown; onAdvance: () => void; onScript: (s: VideoScript) => void;
}) {
  const [draft, setDraft] = useState<VideoScript | null>((script as VideoScript) ?? null);
  const [writing, startWrite] = useTransition();
  const [saving, startSave] = useTransition();

  function write() {
    startWrite(async () => {
      try { const s = await writeScriptForProject(projectId); setDraft(s); onScript(s); }
      catch (e) { toast.error(String(e)); }
    });
  }
  function persist(next: VideoScript) {
    setDraft(next); onScript(next);
    startSave(async () => { try { await saveScript(projectId, next); } catch (e) { toast.error(String(e)); } });
  }
  function go() {
    startSave(async () => { try { await advanceToRecord(projectId); onAdvance(); } catch (e) { toast.error(String(e)); } });
  }

  if (!draft) {
    return <Button onClick={write} disabled={writing}>{writing ? "Writing the script…" : "Write the script"}</Button>;
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-2 pt-5">
        <label className="text-[12px] font-semibold uppercase text-muted-foreground">Title</label>
        <Textarea rows={1} value={draft.title} onChange={(e) => persist({ ...draft, title: e.target.value })} />
        <label className="text-[12px] font-semibold uppercase text-muted-foreground">Hook (pays off &lt;15s)</label>
        <Textarea rows={2} value={draft.hook} onChange={(e) => persist({ ...draft, hook: e.target.value })} />
      </CardContent></Card>

      {draft.beats.map((b, i) => (
        <Card key={b.id}>
          <CardContent className="grid grid-cols-1 gap-3 pt-5 md:grid-cols-2">
            <div>
              <label className="text-[12px] font-semibold uppercase text-muted-foreground">Say {i + 1}</label>
              <Textarea rows={3} value={b.say} onChange={(e) => persist({ ...draft, beats: draft.beats.map((x) => x.id === b.id ? { ...x, say: e.target.value } : x) })} />
            </div>
            <div>
              <label className="text-[12px] font-semibold uppercase text-muted-foreground">On screen</label>
              <Textarea rows={3} value={b.visualPrompt} onChange={(e) => persist({ ...draft, beats: draft.beats.map((x) => x.id === b.id ? { ...x, visualPrompt: e.target.value } : x) })} />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button onClick={write} variant="outline" disabled={writing}>{writing ? "Rewriting…" : "Rewrite"}</Button>
        <Button onClick={go} disabled={saving}>Looks good → Record</Button>
      </div>
    </div>
  );
}
