// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CoachCard } from "@/components/coach-card";

afterEach(() => {
  cleanup();
});

describe("CoachCard", () => {
  it("renders the task and next action", () => {
    render(
      <CoachCard
        assignment={{
          kind: "post",
          task: "Post today: ship it",
          why: "no post yet",
          nextAction: "Open Compose",
        }}
      />,
    );
    expect(screen.getByText(/Post today: ship it/)).toBeTruthy();
    expect(screen.getByText(/Open Compose/)).toBeTruthy();
  });

  it("shows the angle hook when present", () => {
    render(
      <CoachCard
        assignment={{
          kind: "post",
          task: "Post today",
          why: "x",
          nextAction: "go",
          angle: { hook: "my sharp take" },
        }}
      />,
    );
    expect(screen.getByText(/my sharp take/)).toBeTruthy();
  });
});
