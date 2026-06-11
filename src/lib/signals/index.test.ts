import { describe, it, expect, afterEach } from "vitest";
import { getSignalSource } from "@/lib/signals";

describe("getSignalSource", () => {
  const orig = process.env.SIGNAL_SOURCE;
  afterEach(() => {
    if (orig === undefined) delete process.env.SIGNAL_SOURCE;
    else process.env.SIGNAL_SOURCE = orig;
  });

  it("defaults to apify", () => {
    delete process.env.SIGNAL_SOURCE;
    expect(getSignalSource().id).toBe("apify");
  });

  it("throws on unknown source", () => {
    process.env.SIGNAL_SOURCE = "carrier-pigeon";
    expect(() => getSignalSource()).toThrow(/unknown SIGNAL_SOURCE/i);
  });

  it("twitterapi slot exists but is not implemented yet", async () => {
    process.env.SIGNAL_SOURCE = "twitterapi";
    const src = getSignalSource();
    expect(src.id).toBe("twitterapi");
    await expect(src.pullAuthorTweets(["x"], {})).rejects.toThrow(/not implemented/i);
  });
});
