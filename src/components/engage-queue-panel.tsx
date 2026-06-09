"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrandAvatar } from "@/components/ui/brand-avatar";
import { ScorePill } from "@/components/ui/score-bar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";
import { getEngageQueue, scanNow, type EngageItem } from "@/server/engage-queue";
import { dismissCandidate, markPosted, markRepliedQuick } from "@/server/posts";
import { safeHref } from "@/lib/safe-url";

const SCENARIO_LABEL: Record<string, string> = {
  supportive: "🤝 Supportive",
  contrarian: "🥊 Contrarian",
  witty: "😏 Witty",
  technical: "🔬 Technical",
  question: "❓ Question",
};

export function EngageQueuePanel({
  profiles,
  initialItems = [],
}: {
  profiles: { id: string; handle: string }[];
  initialItems?: EngageItem[];
}) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [items, setItems] = useState<EngageItem[] | null>(initialItems.length ? initialItems : null);
  const [busy, start] = useTransition();

  function scan() {
    start(async () => {
      try {
        await scanNow(profileId);
        setItems(await getEngageQueue(profileId));
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  function load() {
    start(async () => {
      try {
        setItems(await getEngageQueue(profileId));
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.handle}
            </option>
          ))}
        </StyledSelect>
        <Button disabled={busy || !profileId} onClick={scan}>
          {busy ? "Scanning…" : "Scan for opportunities"}
        </Button>
        <Button variant="outline" disabled={busy || !profileId} onClick={load}>
          Show latest
        </Button>
      </div>

      {items && items.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          No surfaced opportunities yet — run a scan.
        </p>
      )}
      {items?.map((it) => (
        <EngageCard key={it.candidateId} item={it} />
      ))}
    </div>
  );
}

function EngageCard({ item }: { item: EngageItem }) {
  const [reply, setReply] = useState(item.reply ?? "");
  const [done, setDone] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();

  if (done) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center gap-2">
          <BrandAvatar name={item.authorHandle} size="sm" />
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold">{item.authorHandle}</div>
            <div className="text-[12px] text-muted-foreground">
              {item.freshness} · {item.replies} replies
            </div>
          </div>
          <span className="ml-auto flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                item.fit.inBand
                  ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {item.fit.label}
            </span>
            <ScorePill value={item.score} />
          </span>
        </div>

        <p className="border-l-[3px] border-primary/40 pl-3 text-[13.5px] text-muted-foreground">
          {item.post}
        </p>

        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          {item.scenario && (
            <span className="rounded-full bg-[color-mix(in_oklab,var(--brand-text)_12%,transparent)] px-2 py-0.5 font-semibold text-brand-text">
              {SCENARIO_LABEL[item.scenario] ?? item.scenario}
            </span>
          )}
          <span>your reply — edit or tap copy</span>
        </div>

        <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(reply);
              toast.success("Copied");
            }}
          >
            Copy reply
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !reply.trim()}
            onClick={() =>
              start(async () => {
                try {
                  await markRepliedQuick(item.profileId, {
                    draftId: item.draftId ?? undefined,
                    candidateId: item.candidateId,
                    reply,
                  });
                  toast.success("Logged ✓ — quota ticked");
                  setDone(true);
                } catch (e) {
                  toast.error(String(e));
                }
              })
            }
          >
            Done
          </Button>
          {item.url && (
            <a
              href={safeHref(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Open post ↗
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await dismissCandidate(item.candidateId);
                  setDone(true);
                } catch (e) {
                  toast.error(String(e));
                }
              })
            }
          >
            Skip
          </Button>
        </div>

        {item.draftId && (
          <div className="flex gap-2">
            <Input
              placeholder="paste posted reply URL to mark done"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || !url}
              onClick={() =>
                start(async () => {
                  try {
                    await markPosted(item.draftId!, url);
                    toast.success("Marked posted");
                    setDone(true);
                  } catch (e) {
                    toast.error(String(e));
                  }
                })
              }
            >
              Mark posted
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
