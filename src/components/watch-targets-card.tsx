"use client";
import { useState, useTransition } from "react";
import { addWatchTarget, removeWatchTarget, type WatchTarget } from "@/server/watch-targets";

export function WatchTargetsCard({
  profileId,
  targets,
}: {
  profileId: string;
  targets: WatchTarget[];
}) {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const r = await addWatchTarget(profileId, handle);
      if (!r.ok) setError(r.error);
      else setHandle("");
    });
  }

  return (
    <div className="rounded-lg border border-border p-4 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-semibold">🎯 Sniper watch list</h3>
        <span className="text-[11px] text-muted-foreground">{targets.length}/10 · polled every 15 min</span>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        Priority handles watched for first-to-comment alerts (Telegram + push).
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {targets.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full border border-border"
          >
            @{t.handle}
            <button
              disabled={pending}
              onClick={() => startTransition(() => removeWatchTarget(profileId, t.id))}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove @${t.handle}`}
            >
              ×
            </button>
          </span>
        ))}
        {targets.length === 0 && (
          <span className="text-[12px] text-muted-foreground">No handles yet — add 5-10 below.</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handle.trim() && add()}
          placeholder="@handle or profile URL"
          className="flex-1 text-[13px] bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          disabled={pending || !handle.trim()}
          onClick={add}
          className="text-[13px] px-3 py-1.5 rounded-md border border-border font-medium disabled:opacity-50"
        >
          Watch
        </button>
      </div>
      {error && <p className="text-[12px] text-rose-400 mt-2">{error}</p>}
    </div>
  );
}
