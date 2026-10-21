// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/server/x-accounts", () => ({ disconnectXAccount: vi.fn() }));

import { ConnectXButton } from "@/components/x/connect-x-button";
import { disconnectXAccount } from "@/server/x-accounts";

afterEach(cleanup);
beforeEach(() => {
  vi.mocked(disconnectXAccount).mockReset().mockResolvedValue({ ok: true });
});

describe("ConnectXButton", () => {
  it("not connected: links to the OAuth start route for this profile", () => {
    render(<ConnectXButton profileId="p-1" connected={false} />);
    expect(screen.getByText(/não ligada/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Ligar conta X" });
    expect(link.getAttribute("href")).toBe("/api/x/oauth/start?profile=p-1");
    expect(screen.getByText(/janela privada/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("encodes the profile id in the link", () => {
    render(<ConnectXButton profileId="a b&c" connected={false} />);
    expect(screen.getByRole("link", { name: "Ligar conta X" }).getAttribute("href")).toBe(
      "/api/x/oauth/start?profile=a%20b%26c",
    );
  });

  it("needs re-auth: shows the handle, flags it, and offers Re-autorizar", () => {
    render(<ConnectXButton profileId="p-1" connected username="cisco" needsReauth />);
    expect(screen.getByText(/@cisco/)).toBeTruthy();
    expect(screen.getByText(/precisa re-autorizar/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Re-autorizar" });
    expect(link.getAttribute("href")).toBe("/api/x/oauth/start?profile=p-1");
    expect(screen.queryByRole("link", { name: "Ligar conta X" })).toBeNull();
    // the private-window hint matters as much when re-authorizing (wrong browser session = wrong account)
    expect(screen.getByText(/janela privada/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /mesmo assim/i })).toBeNull();
  });

  it("connected: shows @handle (ok) and a disconnect button that calls the action", async () => {
    render(<ConnectXButton profileId="p-1" connected username="cisco" needsReauth={false} />);
    expect(screen.getByText(/@cisco/)).toBeTruthy();
    expect(screen.getByText(/ok/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/janela privada/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Desligar" }));
    await waitFor(() => expect(disconnectXAccount).toHaveBeenCalledWith("p-1"));
  });

  it("shows an inline error when disconnecting fails", async () => {
    vi.mocked(disconnectXAccount).mockRejectedValue(new Error("boom"));
    render(<ConnectXButton profileId="p-1" connected username="cisco" />);
    fireEvent.click(screen.getByRole("button", { name: "Desligar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/boom/));
  });
});
