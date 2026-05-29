"use client";
import { useState } from "react";
import { generateThread, scoreDraftBreakout } from "@/server/original";
import type { ThreadDraft, BreakoutScore } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = { hook: "hook", body: "body", cta: "cta" };
const TYPE_VARIANTS: Record<string, "accent" | "secondary" | "outline"> = {
  hook: "accent",
  body: "secondary",
  cta: "outline",
};

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 6 ? "good" : score >= 4 ? "warn" : "bad";
  return <Badge variant={variant}>{score}/7</Badge>;
}

function TweetCard({ tweet, type, idx }: { tweet: string; type: string; idx: number }) {
  const [body, setBody] = useState(tweet);
  const [score, setScore] = useState<BreakoutScore | null>(null);
  const [scoring, setScoring] = useState(false);

  async function checkBreakout() {
    setScoring(true);
    try {
      const result = await scoreDraftBreakout(body);
      setScore(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setScoring(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground font-mono">#{idx + 1}</span>
          <Badge variant={TYPE_VARIANTS[type] ?? "secondary"}>{TYPE_LABELS[type] ?? type}</Badge>
          <span className="text-[12px] text-muted-foreground ml-auto tabular-nums">{body.length}/280</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          rows={Math.max(2, Math.ceil(body.length / 60))}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-[14px]"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}>
            Copy
          </Button>
          <Button size="sm" variant="outline" disabled={scoring} onClick={checkBreakout}>
            {scoring ? "Scoring…" : "Breakout check"}
          </Button>
          {score && (
            <div className="flex items-center gap-2">
              <ScoreBadge score={score.score} />
              <span className="text-[12px] text-muted-foreground">{score.verdict}</span>
            </div>
          )}
        </div>
        {score && score.fixes.length > 0 && (
          <ul className="text-[12px] text-muted-foreground list-disc list-inside space-y-0.5">
            {score.fixes.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ThreadComposer({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState<ThreadDraft | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!topic.trim()) { toast.error("Enter a topic first"); return; }
    setBusy(true);
    try {
      const result = await generateThread(profileId, topic);
      setDraft(result);
      if (result.thin) toast.info("Content may be thin for a thread — consider a single post instead.");
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
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Thread topic or idea</label>
        <Textarea
          rows={2}
          placeholder="What you want to thread about — a finding, experiment, workflow, contrarian take…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={busy}
        />
      </div>

      <Button disabled={busy || !profileId || !topic.trim()} onClick={generate} className="w-full sm:w-auto">
        {busy ? "Drafting thread…" : "Draft thread"}
      </Button>

      {draft?.thin && draft.thin_suggestion && (
        <div className="border border-warning/30 bg-warning/10 rounded-lg p-3 text-sm">
          <span className="font-medium">Content looks thin for a thread.</span>{" "}
          Single-post suggestion: <span className="italic">{draft.thin_suggestion}</span>
        </div>
      )}

      {draft && (
        <div className="space-y-0">
          <p className="text-[13px] text-muted-foreground mb-3">{draft.tweets.length} tweets</p>
          {draft.tweets.map((t, i) => (
            <div key={i} className="relative">
              {i < draft.tweets.length - 1 && (
                <div className="absolute left-[22px] top-full h-3 w-0.5 bg-primary/20 z-10" />
              )}
              <TweetCard idx={i} tweet={t.tweet} type={t.type} />
              {i < draft.tweets.length - 1 && <div className="h-3" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
