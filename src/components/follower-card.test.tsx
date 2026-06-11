// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FollowerCard } from "@/components/follower-card";

afterEach(() => {
  cleanup();
});

describe("FollowerCard", () => {
  it("renders the count and 7d delta", () => {
    render(
      <FollowerCard
        stat={{
          followers: 1234,
          delta7d: 12,
          series: [
            { date: "2026-06-10", followers: 1222 },
            { date: "2026-06-11", followers: 1234 },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("follower-count").textContent).toBe("1.2K");
    expect(screen.getByText(/\+12 this week/)).toBeTruthy();
  });

  it("renders a negative delta", () => {
    render(<FollowerCard stat={{ followers: 100, delta7d: -3, series: [] }} />);
    expect(screen.getByText(/-3 this week/)).toBeTruthy();
  });

  it("renders the empty state when there is no data", () => {
    render(<FollowerCard stat={null} />);
    expect(screen.getByText(/No follower data yet/)).toBeTruthy();
  });
});
