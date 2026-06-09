import { describe, it, expect } from "vitest";
import { evaluateNudge, DEFAULT_NUDGE, type NudgeState, type NudgeSignals } from "@/lib/nudge";

const sig = (over: Partial<NudgeSignals> = {}): NudgeSignals => ({
  today: "2026-06-09", yesterday: "2026-06-08", hour: 9,
  hadActionToday: false, hadActionYesterday: false, streakCurrent: 0, ...over,
});

describe("evaluateNudge", () => {
  it("sends a gentle starter when no streak yet", () => {
    const r = evaluateNudge(DEFAULT_NUDGE, sig({ streakCurrent: 0 }));
    expect(r.send).toBe(true);
    expect(r.text).toMatch(/streak going/i);
    expect(r.nudge.lastSentDate).toBe("2026-06-09");
  });
  it("loss-frames once the streak is >= 2", () => {
    const r = evaluateNudge(DEFAULT_NUDGE, sig({ streakCurrent: 12 }));
    expect(r.text).toMatch(/12-day streak/);
  });
  it("does not send before sendHour", () => {
    const r = evaluateNudge(DEFAULT_NUDGE, sig({ hour: 8 }));
    expect(r.send).toBe(false);
  });
  it("does not send twice in a day", () => {
    const prev: NudgeState = { ...DEFAULT_NUDGE, lastSentDate: "2026-06-09" };
    expect(evaluateNudge(prev, sig()).send).toBe(false);
  });
  it("does not nag once the user has acted today", () => {
    const r = evaluateNudge(DEFAULT_NUDGE, sig({ hadActionToday: true }));
    expect(r.send).toBe(false);
  });
  it("counts an ignore when yesterday's nudge produced no action", () => {
    const prev: NudgeState = { ...DEFAULT_NUDGE, lastSentDate: "2026-06-08", consecutiveIgnored: 0 };
    const r = evaluateNudge(prev, sig({ hadActionYesterday: false }));
    expect(r.nudge.consecutiveIgnored).toBe(1);
  });
  it("silently opts out after the 5th ignore", () => {
    const prev: NudgeState = { ...DEFAULT_NUDGE, lastSentDate: "2026-06-08", consecutiveIgnored: 4 };
    const r = evaluateNudge(prev, sig({ hadActionYesterday: false }));
    expect(r.nudge.optedOut).toBe(true);
    expect(r.send).toBe(false);
  });
  it("re-opts-in and resets the counter on any real action", () => {
    const prev: NudgeState = { ...DEFAULT_NUDGE, optedOut: true, consecutiveIgnored: 7 };
    const r = evaluateNudge(prev, sig({ hadActionToday: true }));
    expect(r.nudge.optedOut).toBe(false);
    expect(r.nudge.consecutiveIgnored).toBe(0);
  });
});
