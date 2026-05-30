"use client";
import { useState, useTransition } from "react";
import { generateReplyQueue } from "@/server/engage";
import { saveDraftToQueue, markPosted } from "@/server/posts";
import type { ReplyOpportunity, ReplyQueue } from "@/lib/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";

function ReplyCard({ opp, profileId }: { opp: ReplyOpportunity; profileId: string }) {
  const [reply, setReply] = useState(opp.reply);
  const [skipped, setSkipped] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [url, setUrl] = useState(opp.targetUrl ?? "");
  const [pending, start] = useTransition();

  if (skipped) return null;

  function save() {
    start(async () => {
      try {
        const id = await saveDraftToQueue(profileId, { kind: "reply", body: reply });
        setDraftId(id);
        toast.success("Saved to queue");
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  function post() {
    start(async () => {
      try {
        if (!draftId) return;
        await markPosted(draftId, url);
        toast.success("Marked posted");
        setSkipped(true);
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[13.5px]">
            <span className="font-semibold">{opp.targetHandle}</span>
            {opp.targetLikes > 0 && (
              <span className="text-[12px] text-muted-foreground tabular-nums">{opp.targetLikes} likes</span>
            )}
            {opp.postedAt && (
              <span className="text-[12px] text-muted-foreground">{opp.postedAt}</span>
            )}
          </div>
          <p className="text-[13.5px] text-muted-foreground border-l-[3px] border-primary/40 pl-3">
            {opp.targetPost}
          </p>
          <p className="text-[12px] text-muted-foreground italic">{opp.reason}</p>
        </div>
        <Textarea
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="font-mono text-[14px]"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => { navigator.clipboard.writeText(reply); toast.success("Copied"); }}
          >
            Copy reply
          </Button>
          {draftId ? (
            <span className="inline-flex items-center text-[12px] text-success font-medium px-1">Saved ✓</span>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending || !profileId || !reply.trim()} onClick={save}>
              {pending ? "Saving…" : "Save to queue"}
            </Button>
          )}
          {opp.targetUrl && (
            <a
              href={opp.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              View post
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSkipped(true)}>
            Skip
          </Button>
        </div>
        {draftId && (
          <div className="flex gap-2">
            <Input placeholder="paste posted reply URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button size="sm" variant="secondary" disabled={pending || !url} onClick={post}>
              Mark posted
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
      <div className="flex items-center gap-3 flex-wrap">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.handle}</option>
          ))}
        </StyledSelect>
        <Button disabled={busy || !profileId} onClick={generate}>
          {busy ? "Scanning seed accounts..." : "Generate reply queue"}
        </Button>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      {queue && (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {queue.generatedAt} · {queue.opportunities.length} opportunities
          </p>
          {queue.opportunities.length === 0 && (
            <p className="text-muted-foreground text-[13px]">Nothing worth replying to right now.</p>
          )}
          {queue.opportunities.map((opp) => (
            <ReplyCard
              key={opp.targetUrl || `${opp.targetHandle}-${opp.targetPost.slice(0, 40)}`}
              opp={opp}
              profileId={profileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
