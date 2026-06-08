import { describe, it, expect } from "vitest";
import { pickAssignment, type CoachInput } from "@/lib/coach/assignment";

const base: CoachInput = {
  postedToday: false,
  repliesDoneToday: 0,
  replyQuota: 5,
  surfacedCandidates: 8,
  topAngle: null,
};

describe("pickAssignment", () => {
  it("assigns a POST with the gated angle when nothing posted yet", () => {
    const a = pickAssignment({ ...base, topAngle: { hook: "ship a thing", source: "https://x.com/1" } });
    expect(a.kind).toBe("post");
    expect(a.angle?.hook).toBe("ship a thing");
    expect(a.nextAction.toLowerCase()).toContain("compose");
    // The card renders the angle on its own line, so the task must NOT also
    // embed it — otherwise the (often paragraph-long) hook shows up twice.
    expect(a.task).not.toContain("ship a thing");
  });

  it("assigns a POST but points to trend radar when no angle survived the gate", () => {
    const a = pickAssignment({ ...base, topAngle: null });
    expect(a.kind).toBe("post");
    expect(a.angle).toBeUndefined();
    expect(a.nextAction.toLowerCase()).toContain("trend");
  });

  it("assigns REPLIES once posted, when quota not met and targets exist", () => {
    const a = pickAssignment({ ...base, postedToday: true, repliesDoneToday: 1, surfacedCandidates: 8 });
    expect(a.kind).toBe("reply");
    expect(a.task).toContain("4");
    expect(a.nextAction.toLowerCase()).toContain("engage");
  });

  it("tells the user to scan when posted, replies pending, but no targets surfaced", () => {
    const a = pickAssignment({ ...base, postedToday: true, repliesDoneToday: 0, surfacedCandidates: 0 });
    expect(a.kind).toBe("reply");
    expect(a.nextAction.toLowerCase()).toContain("scan");
  });

  it("rests when post done and reply quota met", () => {
    const a = pickAssignment({ ...base, postedToday: true, repliesDoneToday: 5, replyQuota: 5 });
    expect(a.kind).toBe("rest");
    expect(a.nextAction.toLowerCase()).toContain("tomorrow");
  });
});
