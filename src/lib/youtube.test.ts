import { describe, it, expect } from "vitest";
import { buildAuthUrl, FORCED_PRIVACY, YT_SCOPES } from "./youtube";

describe("youtube helpers", () => {
  it("forces private uploads in slice 1", () => {
    expect(FORCED_PRIVACY).toBe("private");
  });
  it("requests the upload scope", () => {
    expect(YT_SCOPES).toContain("https://www.googleapis.com/auth/youtube.upload");
  });
  it("buildAuthUrl includes offline access so we get a refresh token", () => {
    const url = buildAuthUrl({ clientId: "cid", redirectUri: "http://localhost:3000/cb", state: "xyz" });
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("client_id=cid");
  });
  it("buildAuthUrl carries the CSRF state token", () => {
    const url = buildAuthUrl({ clientId: "cid", redirectUri: "http://localhost:3000/cb", state: "tok123" });
    expect(url).toContain("state=tok123");
  });
});
