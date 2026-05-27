import { describe, it, expect, vi } from "vitest";
import { AdsPowerClient } from "@/lib/posting/adspower";

function fakeFetch(payload: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => payload });
}

describe("AdsPowerClient", () => {
  it("start() returns the CDP (puppeteer) ws endpoint on code 0", async () => {
    const fetchFn = fakeFetch({ code: 0, data: { ws: { puppeteer: "ws://127.0.0.1:9222/devtools/browser/abc" } } });
    const c = new AdsPowerClient("http://local.adspower.net:50325", fetchFn as unknown as typeof fetch);
    const { wsEndpoint } = await c.start("ads_user_1");
    expect(wsEndpoint).toBe("ws://127.0.0.1:9222/devtools/browser/abc");
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining("/api/v1/browser/start?user_id=ads_user_1"));
  });

  it("start() throws on non-zero code", async () => {
    const fetchFn = fakeFetch({ code: -1, msg: "profile not found" });
    const c = new AdsPowerClient("http://local.adspower.net:50325", fetchFn as unknown as typeof fetch);
    await expect(c.start("missing")).rejects.toThrow(/profile not found/);
  });

  it("stop() calls the stop endpoint", async () => {
    const fetchFn = fakeFetch({ code: 0 });
    const c = new AdsPowerClient("http://local.adspower.net:50325", fetchFn as unknown as typeof fetch);
    await c.stop("ads_user_1");
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining("/api/v1/browser/stop?user_id=ads_user_1"));
  });
});
