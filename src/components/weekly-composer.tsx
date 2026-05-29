"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { generateWeeklyPosts } from "@/server/original";
import type { WeeklyPost, WeeklyPostPlan } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { SkeletonLine } from "@/components/ui/skeleton";
import { toast } from "sonner";

const FORMAT_LABELS: Record<string, string> = {
  "quick-take": "quick take",
  "experiment": "experiment",
  "tool-find": "tool find",
  "observation": "observation",
  "reaction": "reaction",
};

const PROGRESS_MESSAGES = [
  "Researching the world...",
  "Checking GitHub...",
  "Reading the news...",
  "Finding your angles...",
  "Drafting...",
];

function PostCard({ post }: { post: WeeklyPost }) {
  const [body, setBody] = useState(post.posts.join("\n\n"));
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="accent">{FORMAT_LABELS[post.format] ?? post.format}</Badge>
          {post.sourceDate && (
            <span className="text-[11px] text-muted-foreground">{post.sourceDate}</span>
          )}
        </div>
        {post.context && (
          <p className="text-[13px] italic text-muted-foreground mt-1">{post.context}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          rows={Math.min(10, body.split("\n").length + 2)}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-[14px]"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}
          >
            Copy
          </Button>
          {post.source && (
            <a
              href={post.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-text underline underline-offset-2"
            >
              source
            </a>
          )}
          {post.suggestedVisual && (
            <span className="text-xs text-muted-foreground">Visual: {post.suggestedVisual}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function WeeklyComposer({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [journal, setJournal] = useState("");
  const [plan, setPlan] = useState<WeeklyPostPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);

  async function generate() {
    setBusy(true);
    setProgressIdx(0);
    const ticker = setInterval(() => setProgressIdx((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1)), 20_000);
    try {
      const result = await generateWeeklyPosts(profileId, journal || undefined);
      setPlan(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      clearInterval(ticker);
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
        <label htmlFor="journal" className="text-sm text-muted-foreground">
          What are you working on this week? (optional)
        </label>
        <Textarea
          id="journal"
          rows={3}
          placeholder="shipped X, broke Y, noticed Z while building..."
          value={journal}
          onChange={(e) => setJournal(e.target.value)}
          disabled={busy}
        />
      </div>

      <Button disabled={busy || !profileId} onClick={generate} className="w-full sm:w-auto">
        {busy ? PROGRESS_MESSAGES[progressIdx] : "Generate this week's posts"}
      </Button>

      {busy && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary animate-spin" strokeWidth={1.6} />
              <span className="text-[13px] text-muted-foreground">{PROGRESS_MESSAGES[progressIdx]}</span>
            </div>
            <SkeletonLine />
            <SkeletonLine className="w-4/5" />
            <SkeletonLine className="w-3/5" />
          </CardContent>
        </Card>
      )}

      {plan && !busy && (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">Week of {plan.weekOf} · {plan.posts.length} posts</p>
          {plan.posts.map((post, i) => (
            <PostCard key={i} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
