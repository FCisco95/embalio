// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ConsistencyGateCard } from "@/components/performance/consistency-gate-card";
import type { ConsistencyResult } from "@/lib/gate/consistency";

afterEach(cleanup);

function gate(publishDays: number): ConsistencyResult {
  return {
    days: 30,
    publishDays,
    target: 21,
    passed: publishDays >= 21,
    perDay: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      posts: i < publishDays ? 1 : 0,
    })),
  };
}

describe("ConsistencyGateCard", () => {
  it("shows the day count against the target and a 30-cell strip", () => {
    render(<ConsistencyGateCard gate={gate(12)} />);
    expect(screen.getByText("12 de 30 dias com post publicado · meta 21")).toBeTruthy();
    expect(screen.getAllByTestId("day-cell")).toHaveLength(30);
    expect(screen.getAllByTestId("day-cell").filter((c) => c.dataset.posted === "true")).toHaveLength(12);
  });

  it("flags in-progress below target", () => {
    render(<ConsistencyGateCard gate={gate(20)} />);
    expect(screen.getByTestId("consistency-status").dataset.passed).toBe("false");
  });

  it("flags pass at or above target", () => {
    render(<ConsistencyGateCard gate={gate(21)} />);
    expect(screen.getByTestId("consistency-status").dataset.passed).toBe("true");
  });
});
