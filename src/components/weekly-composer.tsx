"use client";
import { useState } from "react";
import { generateWeeklyPosts } from "@/server/original";
import type { WeeklyPost, WeeklyPostPlan } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{FORMAT_LABELS[post.format]}</Badge>
        {post.sourceDate && (
          <span className="text-xs text-muted-foreground">{post.sourceDate}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground italic">{post.context}</p>
      <Textarea
        rows={Math.min(10, body.split("\n").length + 2)}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="font-mono text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}
        >
          Copy
        </Button>
        {post.source && (
          <a href={post.source} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline">
            source
          </a>
        )}
        {post.suggestedVisual && (
          <span className="text-xs text-muted-foreground">Visual: {post.suggestedVisual}</span>
        )}
      </div>
    </div>
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
      <select
        className="border rounded px-2 py-1 text-sm"
        value={profileId}
        onChange={(e) => setProfileId(e.target.value)}
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.handle}</option>
        ))}
      </select>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">
          What are you working on this week? (optional)
        </label>
        <Textarea
          rows={3}
          placeholder="shipped X, broke Y, noticed Z while building..."
          value={journal}
          onChange={(e) => setJournal(e.target.value)}
          disabled={busy}
        />
      </div>

      <Button disabled={busy} onClick={generate} className="w-full sm:w-auto">
        {busy ? PROGRESS_MESSAGES[progressIdx] : "Generate this week's posts"}
      </Button>

      {plan && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Week of {plan.weekOf} · {plan.posts.length} posts</p>
          {plan.posts.map((post, i) => (
            <PostCard key={i} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
