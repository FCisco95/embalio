import { describe, it, expect } from "vitest";
import { knobsFromProfile } from "@/lib/engagement/knobs";

describe("knobsFromProfile", () => {
  it("derives a 5-20x target follower band from account_size", () => {
    const k = knobsFromProfile({ account_size: "500-5k", daily_capacity: "30m", north_star_metric: "grow reach", reply_playbook: null });
    expect(k.ownerFollowerEstimate).toBe(2750);
    expect(k.targetFollowerBand.min).toBe(2750 * 5);
    expect(k.targetFollowerBand.max).toBe(2750 * 20);
  });

  it("maps capacity to a daily reply target", () => {
    expect(knobsFromProfile({ account_size: null, daily_capacity: "10m", north_star_metric: null, reply_playbook: null }).dailyReplyTarget).toBe(5);
    expect(knobsFromProfile({ account_size: null, daily_capacity: "30m", north_star_metric: null, reply_playbook: null }).dailyReplyTarget).toBe(12);
    expect(knobsFromProfile({ account_size: null, daily_capacity: "60m+", north_star_metric: null, reply_playbook: null }).dailyReplyTarget).toBe(20);
  });

  it("defaults gracefully when fields are null", () => {
    const k = knobsFromProfile({ account_size: null, daily_capacity: null, north_star_metric: null, reply_playbook: null });
    expect(k.goal).toBe("general");
    expect(k.dailyReplyTarget).toBe(10);
    expect(k.ownerFollowerEstimate).toBe(250);
    expect(k.replyPlaybook).toBe("");
  });

  it("normalizes the goal", () => {
    expect(knobsFromProfile({ account_size: null, daily_capacity: null, north_star_metric: "generate inbound leads / clients", reply_playbook: null }).goal).toBe("leads");
  });
});
