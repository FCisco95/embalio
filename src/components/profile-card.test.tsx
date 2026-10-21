// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/server/profiles", () => ({ listSeedTargets: vi.fn().mockResolvedValue([]), addSeedTarget: vi.fn() }));
vi.mock("@/server/posting", () => ({ getPostingAccount: vi.fn() }));
vi.mock("@/server/queue", () => ({ getXConnection: vi.fn() }));
vi.mock("@/server/x-accounts", () => ({ disconnectXAccount: vi.fn() }));
vi.mock("@/components/posting-config", () => ({ PostingConfig: () => null }));
vi.mock("@/components/onboarding-wizard", () => ({ OnboardingWizard: () => null }));

import { ProfileCard } from "@/components/profile-card";
import { getXConnection } from "@/server/queue";

const profile = { id: "p-1", handle: "cisco", niche_description: null };

afterEach(cleanup);
beforeEach(() => {
  vi.mocked(getXConnection).mockReset();
});

describe("ProfileCard X row", () => {
  it("shows the not-linked state with the connect link", async () => {
    vi.mocked(getXConnection).mockResolvedValue({ connected: false });
    render(await ProfileCard({ profile }));
    expect(screen.getByText(/não ligada/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ligar conta X" }).getAttribute("href")).toBe("/api/x/oauth/start?profile=p-1");
  });

  it("shows the linked handle", async () => {
    vi.mocked(getXConnection).mockResolvedValue({ connected: true, username: "cisco_x", needsReauth: false });
    render(await ProfileCard({ profile }));
    expect(screen.getByText(/@cisco_x/)).toBeTruthy();
  });

  it("falls back to not-linked when the X lookup fails (e.g. migration not applied)", async () => {
    vi.mocked(getXConnection).mockRejectedValue(new Error('relation "x_accounts" does not exist'));
    render(await ProfileCard({ profile }));
    expect(screen.getByText(/não ligada/i)).toBeTruthy();
  });
});
