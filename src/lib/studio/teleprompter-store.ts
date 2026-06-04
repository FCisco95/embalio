import type { Layout } from "./teleprompter-layout";

export interface StoreData {
  presets: Record<string, Layout>;
  last: Layout | null;
}

export interface TeleprompterStore {
  load(): StoreData;
  save(data: StoreData): void;
}

const EMPTY: StoreData = { presets: {}, last: null };

/** In-memory backend — used by tests and as a server-render no-op. */
export function makeMemoryStore(): TeleprompterStore {
  let data: StoreData = structuredClone(EMPTY);
  return {
    load: () => structuredClone(data),
    save: (d) => {
      data = structuredClone(d);
    },
  };
}

const LS_KEY = "embalio.teleprompter.store";

/** Browser-dev backend — localStorage. Falls back to memory on the server. */
export function makeLocalStore(): TeleprompterStore {
  if (typeof window === "undefined") return makeMemoryStore();
  return {
    load: () => {
      try {
        const parsed: unknown = JSON.parse(
          window.localStorage.getItem(LS_KEY) ?? "{}",
        );
        if (
          parsed !== null &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          return { ...EMPTY, ...(parsed as Partial<StoreData>) };
        }
        return structuredClone(EMPTY);
      } catch {
        return structuredClone(EMPTY);
      }
    },
    save: (d) => {
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(d));
      } catch {
        // QuotaExceededError — discard; stale data on next load is acceptable
      }
    },
  };
}

/** Electron backend — proxies to the main process electron-store via preload. */
export function makeElectronStore(bridge: {
  getStore: () => StoreData;
  setStore: (d: StoreData) => void;
}): TeleprompterStore {
  return { load: () => bridge.getStore(), save: (d) => bridge.setStore(d) };
}

/** Pick the right backend at runtime. */
export function resolveStore(): TeleprompterStore {
  const b = (
    globalThis as {
      embalio?: {
        getStore?: () => StoreData;
        setStore?: (d: StoreData) => void;
      };
    }
  ).embalio;
  if (b?.getStore && b?.setStore)
    return makeElectronStore({ getStore: b.getStore, setStore: b.setStore });
  return makeLocalStore();
}

export function setPreset(
  store: TeleprompterStore,
  slot: string,
  layout: Layout,
): void {
  const data = store.load();
  store.save({ ...data, presets: { ...data.presets, [slot]: layout } });
}

export function getPreset(
  store: TeleprompterStore,
  slot: string,
): Layout | null {
  return store.load().presets[slot] ?? null;
}
