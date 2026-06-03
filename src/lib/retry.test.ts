import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry";

// Deterministic: no real delays, no jitter randomness.
const noSleep = () => Promise.resolve();
const fixed = { jitter: false, sleep: noSleep } as const;

describe("withRetry", () => {
  it("returns immediately when the first attempt succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, fixed);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries then succeeds, passing a 1-based attempt number", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recovered");
    const result = await withRetry(fn, { ...fixed, retries: 2 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 2);
  });

  it("exhausts retries then throws the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always"));
    await expect(withRetry(fn, { ...fixed, retries: 2 })).rejects.toThrow("always");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does not retry when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));
    const shouldRetry = vi.fn().mockReturnValue(false);
    await expect(withRetry(fn, { ...fixed, retries: 5, shouldRetry })).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry with growing backoff delays (factor 2, no jitter)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const delays: number[] = [];
    await expect(
      withRetry(fn, { retries: 3, baseMs: 100, factor: 2, jitter: false, sleep: noSleep, onRetry: (_e, _a, d) => delays.push(d) }),
    ).rejects.toThrow("x");
    expect(delays).toEqual([100, 200, 400]);
  });

  it("caps the delay at maxMs", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const delays: number[] = [];
    await expect(
      withRetry(fn, { retries: 4, baseMs: 1000, factor: 10, maxMs: 5000, jitter: false, sleep: noSleep, onRetry: (_e, _a, d) => delays.push(d) }),
    ).rejects.toThrow("x");
    expect(delays).toEqual([1000, 5000, 5000, 5000]);
  });

  it("rethrows without further attempts once the signal is aborted", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error("first failure");
    });
    await expect(
      withRetry(fn, { ...fixed, retries: 3, signal: controller.signal }),
    ).rejects.toThrow("first failure");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
