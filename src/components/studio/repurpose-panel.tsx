"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createXThreadFromVideo } from "@/server/studio/repurpose";

export function RepurposePanel({ projectId, publish }: { projectId: string; publish: unknown }) {
  const url = (publish as { url?: string } | null)?.url;
  const [done, setDone] = useState(false);
  const [working, startWork] = useTransition();

  function makeThread() {
    startWork(async () => {
      try {
        const r = await createXThreadFromVideo(projectId);
        toast.success(`Drafted a ${r.tweetCount}-tweet thread → sign-off queue`);
        setDone(true);
      } catch (e) { toast.error(String(e)); }
    });
  }

  return (
    <Card><CardContent className="space-y-3 pt-5">
      {url && <p className="text-[13px]">Published (private): <a className="text-brand-text underline" href={url} target="_blank" rel="noreferrer">{url}</a></p>}
      <p className="text-[13px] text-muted-foreground">Turn this video into an X thread. It lands in your existing Engage/Compose sign-off queue.</p>
      <div className="flex gap-2">
        <Button onClick={makeThread} disabled={working}>{working ? "Drafting…" : "Draft X thread"}</Button>
        {done && <a href="/compose" className={cn(buttonVariants({ variant: "outline" }))}>Open queue</a>}
      </div>
    </CardContent></Card>
  );
}
