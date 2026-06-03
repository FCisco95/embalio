"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateChannelPlaybook } from "@/server/studio/playbook";
import type { ChannelPlaybook } from "@/lib/studio/schemas";

/** Shape passed from the Studio page so the panel can show brief provenance. */
export type BriefMeta = { researched_at: string; sources: { title: string; url: string }[] };

export function PlaybookPanel({
  profileId, initialPlaybook, briefMeta,
}: {
  profileId: string;
  initialPlaybook: ChannelPlaybook | null;
  briefMeta: BriefMeta | null;
}) {
  const [playbook, setPlaybook] = useState<ChannelPlaybook | null>(initialPlaybook);
  const [open, setOpen] = useState(!initialPlaybook);
  const [busy, start] = useTransition();

  function run(refreshResearch: boolean) {
    start(async () => {
      try { setPlaybook(await generateChannelPlaybook(profileId, { refreshResearch })); toast.success("Playbook updated"); }
      catch (e) { toast.error(String(e)); }
    });
  }

  if (!playbook) {
    return (
      <Card><CardContent className="flex items-center justify-between gap-3 pt-5">
        <div className="text-[13px] text-muted-foreground">No channel playbook yet — research the algorithm and lay out your path.</div>
        <Button onClick={() => run(false)} disabled={busy || !profileId}>{busy ? "Researching…" : "Generate Channel Playbook"}</Button>
      </CardContent></Card>
    );
  }

  return (
    <Card><CardContent className="space-y-3 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-semibold uppercase text-muted-foreground">Channel Playbook</div>
        <button type="button" aria-expanded={open} aria-label="Toggle channel playbook" className="text-[12px] text-muted-foreground underline" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show"}</button>
      </div>
      {open && (
        <div className="space-y-3 text-[13px]">
          <div><span className="font-semibold">Positioning:</span> {playbook.positioning}</div>
          <div><span className="font-semibold">North-star:</span> dev — {playbook.northStar.devBrand} · organic — {playbook.northStar.organic}</div>
          <div><span className="font-semibold">Pillars:</span> {playbook.pillars.map((p) => p.name).join(" · ")}</div>
          <div><span className="font-semibold">Packaging:</span> {playbook.packagingFormulas.join(" · ")}</div>
          <div>
            <div className="font-semibold">Next moves:</div>
            <ul className="ml-4 list-disc">{playbook.nextMoves.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
          {briefMeta && (
            <details className="text-[12px] text-muted-foreground">
              <summary>Researched {new Date(briefMeta.researched_at).toLocaleDateString()} · {briefMeta.sources.length} sources</summary>
              <ul className="ml-4 mt-1 list-disc">
                {briefMeta.sources.map((s, i) => <li key={i}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}
              </ul>
            </details>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => run(false)} disabled={busy}>{busy ? "Working…" : "Refresh playbook"}</Button>
            <Button size="sm" variant="outline" onClick={() => run(true)} disabled={busy}>{busy ? "Working…" : "Refresh research"}</Button>
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}
