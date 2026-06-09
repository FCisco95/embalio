export interface NudgeState {
  lastSentDate: string | null;
  consecutiveIgnored: number;
  optedOut: boolean;
  sendHour: number;
}

export const DEFAULT_NUDGE: NudgeState = {
  lastSentDate: null, consecutiveIgnored: 0, optedOut: false, sendHour: 9,
};

export interface NudgeSignals {
  today: string;             // localDate(now)
  yesterday: string;         // localDate(now - 1 day)
  hour: number;              // now.getHours()
  hadActionToday: boolean;
  hadActionYesterday: boolean;
  streakCurrent: number;
}

export interface NudgeResult { nudge: NudgeState; send: boolean; text?: string }

const OPT_OUT_AFTER = 5;

/**
 * The whole nudge policy in one pure pass: accrue an ignore for an unanswered
 * prior-day nudge, re-opt-in on any real action, then decide today's single
 * loss-framed send. Returns the next state (lastSentDate stamped when send=true)
 * so the seam can persist it unconditionally.
 */
export function evaluateNudge(prev: NudgeState, s: NudgeSignals): NudgeResult {
  let nudge: NudgeState = { ...prev };

  // 1. Lazy ignore accounting — a nudge sent yesterday that drew no action.
  if (nudge.lastSentDate === s.yesterday && !s.hadActionYesterday) {
    nudge.consecutiveIgnored += 1;
    if (nudge.consecutiveIgnored >= OPT_OUT_AFTER) nudge.optedOut = true;
  }

  // 2. Reward action: any real action re-opts-in and resets the counter.
  if (s.hadActionToday) {
    nudge.consecutiveIgnored = 0;
    nudge.optedOut = false;
  }

  // 3. Decide today's single send.
  const send =
    s.hour >= nudge.sendHour &&
    nudge.lastSentDate !== s.today &&
    !nudge.optedOut &&
    !s.hadActionToday;

  if (!send) return { nudge, send: false };

  const text =
    s.streakCurrent >= 2
      ? `🔥 Don't lose your ${s.streakCurrent}-day streak — one reply keeps it alive.`
      : `One post or reply today gets your streak going.`;

  nudge = { ...nudge, lastSentDate: s.today };
  return { nudge, send: true, text };
}
