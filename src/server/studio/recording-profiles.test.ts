import { describe, it, expect } from "vitest";
import { defaultSeedProfiles } from "./recording-profile-seeds";

describe("defaultSeedProfiles", () => {
  it("produces the Home (Windows) and Travel (Mac) profiles for a profile id", () => {
    const seeds = defaultSeedProfiles("p1");
    expect(seeds).toHaveLength(2);
    const home = seeds.find((s) => s.os === "windows")!;
    expect(home.capture_tool).toBe("OBS+Rapidemo");
    expect(home.profile_id).toBe("p1");
    const travel = seeds.find((s) => s.os === "macos")!;
    expect(travel.capture_tool).toBe("OBS");
  });
});
