"use client";
import { useState } from "react";
import { draftFromTopicRow } from "@/server/topics";
import type { TopicRowView } from "@/server/topics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatAgo } from "@/lib/topics/format";
import { cn } from "@/lib/utils";

interface TopicCardProps {
  topic: TopicRowView;
  profileId: string;
  draftable: boolean;
}

type DraftState = "idle" | "drafting" | "done" | "error";

function scorePillClass(score: number): string {
  if (score >= 75) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
  if (score >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

function kindLabel(kind: unknown): { text: string; className: string } | null {
  if (kind === "spike") return { text: "⚡ spike", className: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300" };
  if (kind === "durable") return { text: "🌱 durable", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" };
  return null;
}

function windowLabel(window: unknown): string | null {
  if (window === "react") return "⚡ react <2h";
  if (window === "verdict") return "🕐 verdict 24–48h";
  if (window === "saturated") return "🪨 saturated";
  return null;
}

export function TopicCard({ topic, profileId, draftable }: TopicCardProps) {
  // Hook must come before any early return (Rules of Hooks)
  const [draftState, setDraftState] = useState<DraftState>("idle");

  const ago = formatAgo(topic.generated_at);
  // Spec: card MUST NOT render if timestamp is unparseable
  if (!ago) return null;

  const why = topic.why;
  const kind = kindLabel(why.kind);
  const window = windowLabel(why.window);

  const numericChips: { label: string; value: number }[] = [];
  const chipKeys: [string, string][] = [
    ["niche_fit", "niche"],
    ["heat", "heat"],
    ["credibility", "cred"],
    ["timing", "timing"],
  ];
  for (const [key, label] of chipKeys) {
    const val = why[key];
    if (typeof val === "number") numericChips.push({ label, value: val });
  }

  async function handleDraft() {
    if (draftState === "done") return;
    setDraftState("drafting");
    try {
      await draftFromTopicRow(profileId, topic.id);
      setDraftState("done");
    } catch {
      setDraftState("error");
    }
  }

  const draftButtonLabel =
    draftState === "drafting" ? "Drafting…"
    : draftState === "done" ? "In queue ✓ — open Composer"
    : draftState === "error" ? "Failed — tap to retry"
    : "Draft this";

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        {/* Header: topic + score */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span className="font-semibold text-[14px] leading-snug flex-1">{topic.topic}</span>
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold shrink-0",
              scorePillClass(topic.score)
            )}
          >
            {topic.score}
          </span>
        </div>

        {/* why_now */}
        {typeof why.why_now === "string" && why.why_now && (
          <p className="text-[12px] text-muted-foreground">{why.why_now}</p>
        )}

        {/* angle */}
        {topic.angle && (
          <p className="text-[13px]">
            <span className="text-muted-foreground">→ </span>
            {topic.angle}
          </p>
        )}

        {/* Chip row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {kind && (
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", kind.className)}>
              {kind.text}
            </span>
          )}
          {window && (
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {window}
            </span>
          )}
          {numericChips.map(({ label, value }) => (
            <span
              key={label}
              className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {label} {value}
            </span>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
            updated {ago}
          </span>
        </div>

        {/* Sources */}
        {topic.sources.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {topic.sources.map((src, i) => (
              <li key={i}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-brand-text underline underline-offset-2 hover:opacity-80"
                >
                  {src.title ?? src.url}
                </a>
                {src.published_at && (
                  <span className="text-[11px] text-muted-foreground"> · {src.published_at}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Draft button */}
        {draftable && (
          <div>
            <Button
              className="w-full"
              disabled={draftState === "drafting" || draftState === "done"}
              onClick={handleDraft}
            >
              {draftButtonLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
