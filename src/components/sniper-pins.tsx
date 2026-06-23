"use client";
import { useState, useTransition } from "react";
import { actOnSniperAlert, confirmSentReply } from "@/server/sniper-actions";
import type { SniperPin } from "@/server/sniper";

const BLOCK_LABEL: Record<string, string> = {
  daily: "50/day cap reached",
  hourly: "20/hr cap reached",
  per_account: "already replied 3× to this account today",
  link: "draft contains a link (not allowed in replies)",
  near_duplicate: "too similar to a recent reply",
};

export function SniperPins({ profileId, pins: initial }: { profileId: string; pins: SniperPin[] }) {
  const [pins, setPins] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((p) => [p.alertId, p.draft ?? ""])),
  );
  const [pending, startTransition] = useTransition();

  if (pins.length === 0) return null;

  function remove(alertId: string) {
    setPins((p) => p.filter((x) => x.alertId !== alertId)); // optimistic — window is minutes
  }

  // Send MUST run inside the tap gesture (window.open / clipboard need it). We open
  // first, then log. Edited text re-derives the intent URL so the human sends what
  // they see.
  function send(p: SniperPin) {
    const text = (drafts[p.alertId] ?? "").trim();
    const url =
      p.draft && text && p.replyUrl.includes("intent/post")
        ? p.replyUrl.replace(/text=[^&]*/, `text=${encodeURIComponent(`@${p.authorHandle.replace(/^@+/, "")} ${text}`)}`)
        : p.replyUrl;
    window.open(url, "_blank", "noopener,noreferrer");
    remove(p.alertId);
    startTransition(() => confirmSentReply(profileId, p.alertId, text).catch(() => {}));
  }

  function skip(alertId: string) {
    remove(alertId);
    startTransition(() => actOnSniperAlert(profileId, alertId, "dismissed").catch(() => {}));
  }

  return (
    <div className="mb-5 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
        🎯 Sniper — be first
      </div>
      {pins.map((p) => {
        const blocked = p.blockedBy.length > 0;
        return (
          <div key={p.alertId} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[13px] font-medium">@{p.authorHandle}</span>
              <span className="text-[11px] text-muted-foreground">
                {p.freshness} · detected in {p.latencyMin}m · score {p.score}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground line-clamp-3 mb-2">{p.text}</p>

            {p.draft !== null && (
              <textarea
                value={drafts[p.alertId] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.alertId]: e.target.value }))}
                rows={2}
                className="w-full text-[13px] rounded-md border border-border bg-background p-2 mb-2"
              />
            )}

            {blocked && (
              <div className="text-[11px] text-red-500 mb-2">
                ⚠ {p.blockedBy.map((b) => BLOCK_LABEL[b] ?? b).join(" · ")}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                disabled={pending || blocked}
                onClick={() => send(p)}
                className="text-[12px] px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-500 font-medium disabled:opacity-40"
              >
                Send ↗
              </button>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                Open tweet
              </a>
              <button
                disabled={pending}
                onClick={() => skip(p.alertId)}
                className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                ⏭️ Skip
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
