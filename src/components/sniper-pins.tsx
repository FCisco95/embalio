"use client";
import { useState, useTransition } from "react";
import { actOnSniperAlert } from "@/server/sniper-actions";
import type { SniperPin } from "@/server/sniper";

export function SniperPins({ profileId, pins: initial }: { profileId: string; pins: SniperPin[] }) {
  const [pins, setPins] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (pins.length === 0) return null;

  function act(alertId: string, action: "acted" | "dismissed") {
    setPins((p) => p.filter((x) => x.alertId !== alertId)); // optimistic — the window is minutes
    startTransition(() => actOnSniperAlert(profileId, alertId, action).catch(() => {}));
  }

  return (
    <div className="mb-5 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
        🎯 Sniper — be first
      </div>
      {pins.map((p) => (
        <div
          key={p.alertId}
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[13px] font-medium">@{p.authorHandle}</span>
            <span className="text-[11px] text-muted-foreground">
              {p.freshness} · detected in {p.latencyMin}m · score {p.score}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground line-clamp-3 mb-2">{p.text}</p>
          <div className="flex items-center gap-2">
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-500 font-medium"
            >
              Open & reply ↗
            </a>
            <button
              disabled={pending}
              onClick={() => act(p.alertId, "acted")}
              className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              ✅ Done
            </button>
            <button
              disabled={pending}
              onClick={() => act(p.alertId, "dismissed")}
              className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              ⏭️ Skip
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
