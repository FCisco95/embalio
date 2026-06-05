// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readManualScript,
  writeManualScript,
  clearManualScript,
  subscribeManualScript,
  MANUAL_SCRIPT_KEY,
} from "./manual-script";

afterEach(() => localStorage.clear());

describe("manual-script", () => {
  it("round-trips text through storage", () => {
    expect(readManualScript()).toBeNull();
    writeManualScript("Say this. Then that.");
    expect(readManualScript()).toBe("Say this. Then that.");
    clearManualScript();
    expect(readManualScript()).toBeNull();
  });

  it("notifies subscribers on cross-window storage events for its key only", () => {
    const cb = vi.fn();
    const off = subscribeManualScript(cb);

    window.dispatchEvent(new StorageEvent("storage", { key: MANUAL_SCRIPT_KEY }));
    expect(cb).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    expect(cb).toHaveBeenCalledTimes(1);

    // key === null means "storage cleared" — must also notify
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(cb).toHaveBeenCalledTimes(2);

    off();
    window.dispatchEvent(new StorageEvent("storage", { key: MANUAL_SCRIPT_KEY }));
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
