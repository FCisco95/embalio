"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { markPosted, dismissCandidate } from "@/server/posts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CandidateCard({ candidate }: { candidate: any }) {
  const draft = candidate.drafts?.[0];
  const [url, setUrl] = useState("");
  return (
    <Card className="p-4 space-y-2">
      <div className="text-sm text-muted-foreground">@{candidate.author_handle} · score {Number(candidate.score_composite).toFixed(2)}</div>
      <a href={candidate.tweet_url} target="_blank" className="block text-sm underline">{candidate.tweet_text}</a>
      {draft && (
        <>
          <div className="rounded bg-muted p-2 text-sm">{draft.body}</div>
          {draft.suggested_visual && <div className="text-xs text-muted-foreground">🖼 {draft.suggested_visual}</div>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { navigator.clipboard.writeText(draft.body); toast.success("Copied"); }}>Copy reply</Button>
            <Button size="sm" variant="ghost" onClick={async () => { await dismissCandidate(candidate.id); toast.success("Dismissed"); }}>Dismiss</Button>
          </div>
          <div className="flex gap-2">
            <Input placeholder="paste posted tweet URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button size="sm" variant="secondary" onClick={async () => {
              try { await markPosted(draft.id, url); toast.success("Marked posted"); setUrl(""); } catch (e) { toast.error(String(e)); }
            }}>Mark posted</Button>
          </div>
        </>
      )}
    </Card>
  );
}
