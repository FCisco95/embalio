import { describe, it, expect } from "vitest";
import { buildReplyIntentUrl, buildStatusUrl } from "@/lib/send/intent";

describe("buildReplyIntentUrl", () => {
  it("threads under the target tweet and prefixes the @author", () => {
    const url = buildReplyIntentUrl("123", "alice", "great point about latency");
    expect(url).toBe(
      "https://x.com/intent/post?in_reply_to=123&text=%40alice%20great%20point%20about%20latency",
    );
  });
  it("strips a leading @ from the handle so we never double it", () => {
    expect(buildReplyIntentUrl("1", "@bob", "hi")).toContain("text=%40bob%20hi");
  });
  it("url-encodes newlines, hashes and ampersands in the draft", () => {
    const url = buildReplyIntentUrl("1", "a", "x #y & z\nq");
    expect(url).toContain("%40a%20x%20%23y%20%26%20z%0Aq");
  });
});

describe("buildStatusUrl", () => {
  it("links to the tweet so the native app intercepts it (fallback path)", () => {
    expect(buildStatusUrl("carol", "999")).toBe("https://x.com/carol/status/999");
  });
  it("strips a leading @ from the handle", () => {
    expect(buildStatusUrl("@dan", "5")).toBe("https://x.com/dan/status/5");
  });
});
