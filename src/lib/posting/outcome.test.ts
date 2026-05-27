import { describe, it, expect } from "vitest";
import { isConfirmedTweetUrl } from "@/lib/posting/outcome";

describe("isConfirmedTweetUrl", () => {
  it("accepts a real status URL", () => {
    expect(isConfirmedTweetUrl("https://x.com/cisco/status/123456")).toBe(true);
  });
  it("rejects the compose URL (post not confirmed)", () => {
    expect(isConfirmedTweetUrl("https://x.com/compose/post")).toBe(false);
  });
  it("rejects junk", () => {
    expect(isConfirmedTweetUrl("not a url")).toBe(false);
  });
});
