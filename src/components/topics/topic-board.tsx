"use client";
import { useState, useEffect, useTransition } from "react";
import { getTopicBoard } from "@/server/topics";
import type { TopicBoardView } from "@/server/topics";
import { StyledSelect } from "@/components/ui/select-native";
import { TopicCard } from "./topic-card";

interface TopicBoardProps {
  profiles: { id: string; handle: string }[];
}

export function TopicBoard({ profiles }: TopicBoardProps) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [view, setView] = useState<TopicBoardView | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const result = await getTopicBoard(profileId);
        if (!cancelled) setView(result);
      } catch {
        if (!cancelled) setView(null);
      }
    });
    return () => { cancelled = true; };
  }, [profileId]);

  return (
    <div className="space-y-4 max-w-2xl">
      {profiles.length > 1 && (
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.handle}</option>
          ))}
        </StyledSelect>
      )}

      {isPending && (
        <p className="text-[13px] text-muted-foreground">Loading topics…</p>
      )}

      {!isPending && view && (
        <>
          {/* State banners */}
          {view.state === "cached" && (
            <div className="rounded-lg border border-border bg-zinc-50 dark:bg-zinc-900 px-4 py-2 text-[13px] text-muted-foreground">
              Board is over an hour old — background refresh fired.
            </div>
          )}
          {view.state === "briefing" && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950 px-4 py-2 text-[13px] text-sky-700 dark:text-sky-300">
              Low confidence: from today&rsquo;s research briefing — live board pending.
            </div>
          )}
          {view.state === "stale" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-2 text-[13px] text-amber-700 dark:text-amber-300">
              Showing an older board — fresh topics are on the way.
            </div>
          )}

          {/* Empty state */}
          {view.state === "empty" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[13px] text-muted-foreground">
                First board is being generated — check back in a few minutes.
              </p>
            </div>
          )}

          {/* Topic cards */}
          {view.topics.length > 0 && (
            <div className="space-y-3">
              {view.topics.map((t) => (
                <TopicCard
                  key={t.id}
                  topic={t}
                  profileId={profileId}
                  draftable={view.state !== "briefing"}
                />
              ))}
            </div>
          )}
        </>
      )}

      {profiles.length === 0 && (
        <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
      )}
    </div>
  );
}
