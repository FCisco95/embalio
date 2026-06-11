import { describe, it, expect, vi, afterEach } from "vitest";
import { dispatchTopicRefresh } from "./dispatch";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("dispatchTopicRefresh", () => {
  it("no token → false, no network call", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await dispatchTopicRefresh()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("fires workflow_dispatch and returns true on 204", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "tok");
    const f = vi.fn(async () => ({ status: 204 }));
    vi.stubGlobal("fetch", f);
    expect(await dispatchTopicRefresh()).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/repos/FCisco95/embalio/actions/workflows/refresh-topics.yml/dispatches");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual({ ref: "main" });
  });
  it("network error → false, never throws", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    expect(await dispatchTopicRefresh()).toBe(false);
  });
});
