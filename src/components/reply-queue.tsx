"use client";
import { useState } from "react";
import { generateReplyQueue } from "@/server/engage";
import type { ReplyOpportunity, ReplyQueue } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function ReplyCard({ opp }: { opp: ReplyOpportunity }) {
  const [reply, setReply] = useState(opp.reply);
  const [skipped, setSkipped] = useState(false);

  if (skipped) return null;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{opp.targetHandle}</span>
          {opp.targetLikes > 0 && (
            <span className="text-muted-foreground">{opp.targetLikes} likes</span>
          )}
          {opp.postedAt && (
            <span className="text-muted-foreground">{opp.postedAt}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground border-l-2 pl-3">{opp.targetPost}</p>
        <p className="text-xs text-muted-foreground italic">{opp.reason}</p>
      </div>
      <Textarea
        rows={3}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        className="font-mono text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => { navigator.clipboard.writeText(reply); toast.success("Copied"); }}
        >
          Copy reply
        </Button>
        {opp.targetUrl && (
          <a href={opp.targetUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">View post</Button>
          </a>
        )}
        <Button size="sm" variant="ghost" onClick={() => setSkipped(true)}>
          Skip
        </Button>
      </div>
    </div>
  );
}

export function ReplyQueuePanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [queue, setQueue] = useState<ReplyQueue | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const result = await generateReplyQueue(profileId);
      setQueue(result);
      if (result.opportunities.length === 0) {
        toast.info("No reply opportunities found in the last 24h — try again later");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.handle}</option>
          ))}
        </select>
        <Button disabled={busy} onClick={generate}>
          {busy ? "Scanning seed accounts..." : "Generate reply queue"}
        </Button>
      </div>

      {queue && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {queue.generatedAt} · {queue.opportunities.length} opportunities
          </p>
          {queue.opportunities.length === 0 && (
            <p className="text-muted-foreground text-sm">Nothing worth replying to right now.</p>
          )}
          {queue.opportunities.map((opp, i) => (
            <ReplyCard key={i} opp={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
