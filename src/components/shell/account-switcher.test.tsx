// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const setActiveProfile = vi.fn();
vi.mock("@/server/active-profile-actions", () => ({
  setActiveProfile: (id: string) => setActiveProfile(id),
}));

import { AccountSwitcher } from "@/components/shell/account-switcher";

const PROFILES = [
  { id: "p-1", handle: "fcisco95", display_name: "Cisco" },
  { id: "p-2", handle: "@acme", display_name: "Acme Co" },
  { id: "p-3", handle: "nodisplay", display_name: null },
];

beforeEach(() => {
  setActiveProfile.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

function open(activeId = "p-1") {
  render(<AccountSwitcher profiles={PROFILES} activeId={activeId} />);
  fireEvent.click(screen.getByRole("button", { name: /conta ativa/i }));
}

describe("AccountSwitcher", () => {
  it("shows the active account's handle on the trigger", () => {
    render(<AccountSwitcher profiles={PROFILES} activeId="p-2" />);
    const trigger = screen.getByRole("button", { name: /conta ativa/i });
    expect(trigger.textContent).toContain("@acme");
    expect(trigger.textContent).not.toContain("@fcisco95");
  });

  it("lists every profile with handle and display name, and marks the active one", () => {
    open("p-2");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toContain("@fcisco95");
    expect(options[0].textContent).toContain("Cisco");
    expect(options[1].textContent).toContain("Acme Co");
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(options[0].getAttribute("aria-selected")).toBe("false");
  });

  it("calls setActiveProfile with the chosen id and closes the list", async () => {
    open("p-1");
    fireEvent.click(screen.getByRole("option", { name: /acme/i }));
    await waitFor(() => expect(setActiveProfile).toHaveBeenCalledWith("p-2"));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("shows an inline error instead of throwing when the switch fails", async () => {
    setActiveProfile.mockRejectedValue(new Error("Profile not found or access denied"));
    open("p-1");
    fireEvent.click(screen.getByRole("option", { name: /acme/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/não foi possível trocar/i);
    expect(screen.getByRole("button", { name: /conta ativa/i })).toBeTruthy();
  });

  it("does nothing when the already-active account is chosen", () => {
    open("p-1");
    fireEvent.click(screen.getByRole("option", { name: /fcisco95/i }));
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it("links to Contas for adding or editing accounts", () => {
    open();
    expect(screen.getByRole("link", { name: /contas/i }).getAttribute("href")).toBe("/profiles");
  });
});
