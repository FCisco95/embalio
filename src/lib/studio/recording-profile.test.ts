import { describe, it, expect } from "vitest";
import { resolveRecordingProfileId } from "./recording-profile";

describe("resolveRecordingProfileId", () => {
  it("returns the mapped profile id for a known device", () => {
    expect(resolveRecordingProfileId("dev-1", { "dev-1": "rp-home" })).toBe("rp-home");
  });
  it("returns the fallback when the device is unknown", () => {
    expect(resolveRecordingProfileId("dev-x", { "dev-1": "rp-home" }, "rp-travel")).toBe("rp-travel");
  });
  it("returns null when no mapping and no fallback", () => {
    expect(resolveRecordingProfileId(null, {})).toBeNull();
  });
});
