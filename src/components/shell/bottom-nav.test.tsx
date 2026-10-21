// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BottomNav } from "@/components/shell/bottom-nav";
import { NAV } from "@/components/shell/nav-items";

vi.mock("next/navigation", () => ({ usePathname: () => "/engage" }));

afterEach(cleanup);

describe("BottomNav", () => {
  it("renders exactly the four daily-loop tabs: Hoje, Replies, Performance, Contas", () => {
    render(<BottomNav />);
    for (const label of ["Hoje", "Replies", "Performance", "Contas"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("does not render Labs surfaces (Studio, Topics, Composer, Targeting)", () => {
    render(<BottomNav />);
    for (const label of ["Studio", "Topics", "Composer", "Targeting"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });
});

describe("NAV", () => {
  it("keeps every legacy surface reachable, just not primary", () => {
    const hrefs = NAV.map((n) => n.href);
    for (const href of ["/topics", "/compose", "/board", "/studio"]) {
      expect(hrefs).toContain(href);
    }
    const labs = NAV.filter((n) => n.labs);
    expect(labs.every((n) => !n.primary)).toBe(true);
    expect(labs.map((n) => n.href).sort()).toEqual(["/board", "/compose", "/studio", "/topics"]);
  });
});
