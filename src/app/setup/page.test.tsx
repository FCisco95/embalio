import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

const requireSessionUser = vi.fn();
const getActiveProfile = vi.fn();
const getSetupProfileId = vi.fn();
vi.mock("@/server/auth", () => ({ requireSessionUser: () => requireSessionUser() }));
vi.mock("@/server/active-profile", () => ({ getActiveProfile: () => getActiveProfile() }));
vi.mock("@/server/setup", () => ({ getSetupProfileId: () => getSetupProfileId() }));
vi.mock("@/components/setup-quiz", () => ({ SetupQuiz: () => null }));

import SetupPage from "./page";

async function quizProfileId(): Promise<string> {
  const main = (await SetupPage()) as ReactElement<{ children: ReactElement<{ profileId: string }> }>;
  return main.props.children.props.profileId;
}

beforeEach(() => {
  requireSessionUser.mockReset().mockResolvedValue({ id: "u1" });
  getActiveProfile.mockReset();
  getSetupProfileId.mockReset().mockResolvedValue("oldest");
});

describe("/setup profile targeting", () => {
  it("runs the quiz against the cookie-active profile, never the oldest", async () => {
    getActiveProfile.mockResolvedValue({ id: "active-2" });
    await expect(quizProfileId()).resolves.toBe("active-2");
    expect(getSetupProfileId).not.toHaveBeenCalled();
  });

  it("falls back to getSetupProfileId (oldest / create) when the user has no profile", async () => {
    getActiveProfile.mockResolvedValue(null);
    await expect(quizProfileId()).resolves.toBe("oldest");
    expect(getSetupProfileId).toHaveBeenCalledTimes(1);
  });

  it("requires a session first", async () => {
    requireSessionUser.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(SetupPage()).rejects.toThrow("REDIRECT:/login");
    expect(getActiveProfile).not.toHaveBeenCalled();
  });
});
