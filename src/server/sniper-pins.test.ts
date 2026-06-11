import { describe, it, expect } from "vitest";
import { toSniperPin } from "@/server/sniper";

describe("toSniperPin", () => {
  it("maps an alert row to a display pin with 0-100 score and freshness", () => {
    const now = new Date("2026-06-12T10:00:00Z").getTime();
    const pin = toSniperPin(
      {
        id: "a1",
        author_handle: "big",
        tweet_text: "hot take",
        tweet_url: "https://x.com/big/status/1",
        score: 0.72,
        latency_ms: 540_000,
        created_at: "2026-06-12T09:45:00Z",
      },
      now,
    );
    expect(pin).toEqual({
      alertId: "a1",
      authorHandle: "big",
      text: "hot take",
      url: "https://x.com/big/status/1",
      score: 72,
      freshness: "15 min ago",
      latencyMin: 9,
    });
  });
});
