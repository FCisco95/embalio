import { describe, it, expect, vi, afterEach } from "vitest";
import type { ApifyLike } from "@/lib/apify";
import { pullOwnVoiceCorpus } from "@/server/voice-pull";

function fakeClient(items: unknown[]): ApifyLike {
  return {
    actor: () => ({ call: vi.fn().mockResolvedValue({ defaultDatasetId: "ds1" }) }),
    dataset: () => ({ listItems: vi.fn().mockResolvedValue({ items }) }),
  } as unknown as ApifyLike;
}

afterEach(() => { delete process.env.APIFY_TOKEN; });

describe("pullOwnVoiceCorpus", () => {
  it("maps pulled tweets to a trimmed, non-empty text corpus", async () => {
    process.env.APIFY_TOKEN = "tok";
    const client = fakeClient([
      { id: "1", text: " first post ", author: { userName: "me" } },
      { id: "2", text: "", author: { userName: "me" } },
      { id: "3", text: "second", author: { userName: "me" } },
    ]);
    const corpus = await pullOwnVoiceCorpus("@me", client);
    expect(corpus).toEqual(["first post", "second"]);
  });

  it("throws a typed unavailable error when APIFY_TOKEN is not set", async () => {
    await expect(pullOwnVoiceCorpus("@me", fakeClient([]))).rejects.toThrow(/APIFY_TOKEN/);
  });
});
