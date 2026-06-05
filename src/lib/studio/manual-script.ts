/**
 * Manual teleprompter text — typed/pasted by the user in the Record Hub and
 * shown by the overlay INSTEAD of the generated script until cleared.
 *
 * Synced via localStorage + the cross-window `storage` event: the Record Hub
 * (main window / tab) writes, the overlay (Electron window / tab on the same
 * origin) subscribes. No IPC needed — works identically in Electron and
 * browser-dev.
 */
export const MANUAL_SCRIPT_KEY = "embalio.teleprompter.manual";

export function readManualScript(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(MANUAL_SCRIPT_KEY);
}

export function writeManualScript(text: string): void {
  window.localStorage.setItem(MANUAL_SCRIPT_KEY, text);
}

export function clearManualScript(): void {
  window.localStorage.removeItem(MANUAL_SCRIPT_KEY);
}

/** Subscribe to changes made by OTHER windows (storage events don't fire locally). */
export function subscribeManualScript(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    // key === null means the whole store was cleared — that affects us too.
    if (e.key === MANUAL_SCRIPT_KEY || e.key === null) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Server snapshot for useSyncExternalStore (no storage on the server). */
export const serverManualScript = (): string | null => null;
