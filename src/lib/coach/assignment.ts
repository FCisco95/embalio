export interface CoachInput {
  postedToday: boolean;          // an original/thread posted today?
  repliesDoneToday: number;      // replies published today
  replyQuota: number;            // daily reply target (from the growth plan rhythm)
  surfacedCandidates: number;    // reply targets currently surfaced
  topAngle: { hook: string; source?: string } | null; // top gated trend angle (only when not posted)
}

export interface DailyAssignment {
  kind: "post" | "reply" | "rest";
  task: string;        // the one job, one line
  why: string;         // why this is the move today
  nextAction: string;  // the concrete next step / where to go
  angle?: { hook: string; source?: string };
}

/**
 * The whole coach in one deterministic function: ONE assignment a day.
 * Order of priority: ship today's post -> work the reply quota -> rest.
 * Never suggests a second post once one is up (daily reach budget).
 */
export function pickAssignment(input: CoachInput): DailyAssignment {
  if (!input.postedToday) {
    if (input.topAngle) {
      return {
        kind: "post",
        task: `Post today: ${input.topAngle.hook}`,
        why: "You haven't posted yet, and this rides a live trend you can credibly speak to.",
        nextAction: "Open Compose and draft from this angle.",
        angle: input.topAngle,
      };
    }
    return {
      kind: "post",
      task: "Post today — pick an angle.",
      why: "You haven't posted yet, and no surfaced trend cleared the credibility gate.",
      nextAction: "Run the Trend Radar and pick an angle to draft.",
    };
  }

  const remaining = Math.max(0, input.replyQuota - input.repliesDoneToday);
  if (remaining > 0) {
    return {
      kind: "reply",
      task: `Reply to ${remaining} more account${remaining === 1 ? "" : "s"} today.`,
      why: "Your post is up. Replies out-reach posts — this is the highest-ROI time you spend.",
      nextAction: input.surfacedCandidates > 0
        ? "Open Engage and work the reply queue."
        : "Run a scan to surface fresh reply targets, then work the queue.",
    };
  }

  return {
    kind: "rest",
    task: "You're done for today.",
    why: "Post shipped and reply quota met. Don't spend reach on filler.",
    nextAction: "Optional: prep tomorrow's angle.",
  };
}
