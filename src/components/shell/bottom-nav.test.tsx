// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BottomNav } from "@/components/shell/bottom-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/engage" }));

afterEach(cleanup);

describe("BottomNav", () => {
  it("renders the primary tabs including Engage", () => {
    render(<BottomNav />);
    expect(screen.getByText("Engage")).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("does not render non-primary tabs (Studio)", () => {
    render(<BottomNav />);
    expect(screen.queryByText("Studio")).toBeNull();
  });
});
