// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StrategyCard } from "./strategy-card";
import type { StrategySnapshot } from "@/lib/strategy/schemas";

vi.mock("@/server/strategy", () => ({ applyTargetRecommendation: vi.fn(async () => ({ ok: true, added: 1, dropped: 0 })) }));

const snap: StrategySnapshot = {
  weekOf: "2026-06-15",
  cluster: { alignment: 0.72, band: "core", nicheSize: 12, spread: 0.2 },
  targets: { picks: [{ handle: "@paulg", priority: "high", reason: "overlap", suggested_approach: "reply to threads" }], generatedAt: "2026-06-18" },
  attribution: { status: "correlation", n: 28, r: 0.41, label: "correlation", disclaimer: "Correlation only — not proof replies drive follows." },
  recommendations: { adds: [{ handle: "@new", priority: "high", reason: "rising", suggested_approach: "quote-tweet" }], drops: [{ handle: "@dead", reason: "no activity" }] },
  generatedAt: "2026-06-18T00:00:00.000Z",
};

describe("StrategyCard", () => {
  it("labels attribution as correlation, never causation", () => {
    render(<StrategyCard snapshot={snap} profileId="p1" />);
    expect(screen.getByText(/correlation/i)).toBeInTheDocument();
    expect(screen.queryByText(/caus(e|ation)/i)).toBeNull();
  });

  it("shows approve controls for adds/drops (human-in-the-loop)", () => {
    render(<StrategyCard snapshot={snap} profileId="p1" />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
  });
});
