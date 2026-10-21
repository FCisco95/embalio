// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { XOAuthBanner } from "@/components/x/oauth-banner";

afterEach(cleanup);

describe("XOAuthBanner", () => {
  it("renders nothing without an x outcome or with an unknown one", () => {
    const { container, rerender } = render(<XOAuthBanner />);
    expect(container.textContent).toBe("");
    rerender(<XOAuthBanner x="whatever" />);
    expect(container.textContent).toBe("");
  });

  it.each([
    ["connected", /ligada/i],
    ["denied", /recusada/i],
    ["error", /não foi possível/i],
  ])("one line for x=%s", (x, text) => {
    render(<XOAuthBanner x={x} />);
    expect(screen.getByRole("status").textContent).toMatch(text);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("already-linked names the handle", () => {
    render(<XOAuthBanner x="already-linked" handle="cisco" />);
    expect(screen.getByRole("status").textContent).toMatch(/@cisco.*outro perfil/i);
  });

  it("mismatch names both handles and offers Ligar mesmo assim with force=1 for that profile", () => {
    render(<XOAuthBanner x="mismatch" handle="cisco" expected="other_brand" profile="p 1" />);
    expect(screen.getByRole("status").textContent).toMatch(/@cisco/);
    expect(screen.getByRole("status").textContent).toMatch(/@other_brand/);
    const link = screen.getByRole("link", { name: "Ligar mesmo assim" });
    expect(link.getAttribute("href")).toBe("/api/x/oauth/start?profile=p%201&force=1");
  });

  it("mismatch without a profile id offers no force link", () => {
    render(<XOAuthBanner x="mismatch" handle="cisco" expected="other_brand" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("account-changed tells the operator to disconnect first, with no force link", () => {
    render(<XOAuthBanner x="account-changed" handle="cisco" />);
    expect(screen.getByRole("status").textContent).toMatch(/desliga/i);
    expect(screen.getByRole("status").textContent).toMatch(/@cisco/);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not double an @ the query string already carries", () => {
    render(<XOAuthBanner x="already-linked" handle="@cisco" />);
    expect(screen.getByRole("status").textContent).toMatch(/@cisco/);
    expect(screen.getByRole("status").textContent).not.toMatch(/@@/);
  });
});
