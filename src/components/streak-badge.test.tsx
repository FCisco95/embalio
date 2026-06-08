// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StreakBadge } from "@/components/streak-badge";

const fire = vi.fn();
vi.mock("@/components/reward-burst", () => ({ useReward: () => ({ fire, burst: null }) }));

afterEach(() => {
  cleanup();
});

describe("StreakBadge", () => {
  beforeEach(() => {
    fire.mockClear();
    localStorage.clear();
  });

  it("renders the streak count", () => {
    render(<StreakBadge streak={3} />);
    // Target the count span specifically — "3" alone is unambiguous here,
    // but scope to the testid so "days" text can never collide.
    expect(screen.getByTestId("streak-count").textContent).toBe("3");
  });

  it("fires the reward when the streak grows past last-seen", () => {
    localStorage.setItem("embalio:lastStreak", "2");
    render(<StreakBadge streak={3} />);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("does not fire when the streak is unchanged", () => {
    localStorage.setItem("embalio:lastStreak", "3");
    render(<StreakBadge streak={3} />);
    expect(fire).not.toHaveBeenCalled();
  });
});
