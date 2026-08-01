"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordReplyOutcome } from "@/server/sniper-actions";
import { Card, CardContent } from "@/components/ui/card";
import { daysUntilWindowExit, windowExitDate, EXPIRY_WARN_DAYS, DEFAULT_WINDOW_DAYS } from "@/lib/gate/expiry";
import type { ActedAlertRow } from "@/server/gate";

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Amber "about to age out" chip — the outcome is only worth recording until then. */
function ExpiryChip({ createdAt, windowDays }: { createdAt: string; windowDays: number }) {
  const left = daysUntilWindowExit(createdAt, windowDays, new Date());
  if (left === null || left > EXPIRY_WARN_DAYS) return null;
  const on = windowExitDate(createdAt, windowDays);
  const label =
    left < 0 ? "outside the window" : left === 0 ? "leaves the scorecard today" : `leaves the scorecard in ${left}d`;
  return (
    <span
      title={on ? `Drops out of the ${windowDays}-day window on ${on}` : undefined}
      className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500"
    >
      {label}
    </span>
  );
}

/** Manual reply-outcome capture for acted alerts (GATE-2 input). No X scrape. */
export function ReplyOutcomeList({
  profileId,
  alerts,
  windowDays = DEFAULT_WINDOW_DAYS,
}: {
  profileId: string;
  alerts: ActedAlertRow[];
  windowDays?: number;
}) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 px-4 py-6 text-center text-[13px] text-muted-foreground">
        No acted replies yet — once you send a sniper reply, it shows up here to record its outcome.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <OutcomeRow key={a.id} profileId={profileId} alert={a} windowDays={windowDays} />
      ))}
    </div>
  );
}

function OutcomeRow({
  profileId,
  alert,
  windowDays,
}: {
  profileId: string;
  alert: ActedAlertRow;
  windowDays: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [impr, setImpr] = useState(alert.reply_impressions?.toString() ?? "");
  const [median, setMedian] = useState(alert.author_median_reply_impressions?.toString() ?? "");
  const [replyBack, setReplyBack] = useState<boolean | null>(alert.author_reply_back);

  function save() {
    setSaved(false);
    start(async () => {
      try {
        await recordReplyOutcome(profileId, alert.id, {
          replyImpressions: numOrNull(impr),
          authorMedianReplyImpressions: numOrNull(median),
          authorReplyBack: replyBack,
        });
        setSaved(true);
        router.refresh();
      } catch {
        // failure leaves the row unsaved; the owner can retry
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-4">
        <div className="flex items-center justify-between gap-2">
          <a
            href={alert.tweet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium hover:underline"
          >
            @{alert.author_handle}
          </a>
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ExpiryChip createdAt={alert.created_at} windowDays={windowDays} />
            {alert.sent_at ? alert.sent_at.slice(0, 10) : "—"}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground line-clamp-2">{alert.tweet_text}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] text-muted-foreground">
            Your reply impressions
            <input
              inputMode="numeric"
              value={impr}
              onChange={(e) => setImpr(e.target.value)}
              className="mt-0.5 block w-28 rounded-md border border-border bg-background px-2 py-1 text-[13px]"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Author median reply impr.
            <input
              inputMode="numeric"
              value={median}
              onChange={(e) => setMedian(e.target.value)}
              className="mt-0.5 block w-28 rounded-md border border-border bg-background px-2 py-1 text-[13px]"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Author replied back
            <select
              value={replyBack === null ? "" : replyBack ? "yes" : "no"}
              onChange={(e) => setReplyBack(e.target.value === "" ? null : e.target.value === "yes")}
              className="mt-0.5 block rounded-md border border-border bg-background px-2 py-1 text-[13px]"
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <button
            disabled={pending}
            onClick={save}
            className="text-[12px] px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-500 font-medium disabled:opacity-40"
          >
            {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
