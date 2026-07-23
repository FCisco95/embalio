/**
 * Unified daily plan: the home card's single ordered checklist for today.
 * Pure derivation over already-fetched inputs — the server aggregator
 * (src/server/daily-plan.ts) does the reads, this decides what to show.
 * Order is fixed: do the assignment, then the best topic, then clear data
 * debt (pending reply outcomes, stale analytics CSV).
 */
import type { DailyAssignment } from "./assignment";

export interface DailyPlanTopic {
  id: string;
  topic: string;
  angle: string;
  score: number;
}

export interface DailyPlanInputs {
  assignment: DailyAssignment;
  topTopic: DailyPlanTopic | null;
  /** acted alerts with NULL reply_impressions (GATE-2 scorecard is starving). */
  pendingOutcomes: number;
  /** newest analytics_daily.date (YYYY-MM-DD) or null when none imported. */
  analyticsDataThrough: string | null;
  /** today as YYYY-MM-DD (UTC) — injected so the lib stays pure/testable. */
  todayIso: string;
}

export interface DailyPlanItem {
  kind: "assignment" | "topic" | "outcomes" | "csv";
  title: string;
  detail?: string;
  href: string;
  cta: string;
  /** true renders as checked-off (rest day: assignment complete). */
  done?: boolean;
}

const CSV_STALE_DAYS = 7;

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.floor((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

export function buildDailyPlan(i: DailyPlanInputs): DailyPlanItem[] {
  const items: DailyPlanItem[] = [];

  items.push({
    kind: "assignment",
    title: i.assignment.task,
    detail: i.assignment.nextAction,
    href: i.assignment.kind === "reply" ? "/engage" : "/compose",
    cta: i.assignment.kind === "reply" ? "Open Engage" : "Open Compose",
    done: i.assignment.kind === "rest",
  });

  if (i.topTopic) {
    items.push({
      kind: "topic",
      title: `Top topic: ${i.topTopic.topic}`,
      detail: i.topTopic.angle || undefined,
      href: "/topics",
      cta: "Draft this",
    });
  }

  if (i.pendingOutcomes > 0) {
    items.push({
      kind: "outcomes",
      title: `${i.pendingOutcomes} sent repl${i.pendingOutcomes === 1 ? "y" : "ies"} missing outcomes`,
      detail: "Read impressions off the X app and log them — the GATE-2 scorecard can't compute without them.",
      href: "/performance/gate-2",
      cta: "Log outcomes",
    });
  }

  const stale =
    i.analyticsDataThrough === null || daysBetween(i.analyticsDataThrough, i.todayIso) > CSV_STALE_DAYS;
  if (stale) {
    items.push({
      kind: "csv",
      title:
        i.analyticsDataThrough === null
          ? "No analytics imported yet"
          : `Analytics stale — last import ${i.analyticsDataThrough}`,
      detail: "Export the X analytics CSV and re-import so visit-lift stays current.",
      href: "/performance",
      cta: "Import CSV",
    });
  }

  return items;
}
