export type DeviceMap = Record<string, string>; // deviceId -> recording_profile.id

export function resolveRecordingProfileId(
  deviceId: string | null,
  map: DeviceMap,
  fallback?: string,
): string | null {
  if (deviceId && map[deviceId]) return map[deviceId];
  return fallback ?? null;
}

// --- Browser-only helpers (guarded so the module is import-safe on the server) ---

const DEVICE_ID_KEY = "embalio.studio.deviceId";
const DEVICE_MAP_KEY = "embalio.studio.deviceMap";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (window.crypto?.randomUUID?.() ?? `dev-${Date.now()}`);
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function readDeviceMap(): DeviceMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(DEVICE_MAP_KEY) ?? "{}") as DeviceMap;
  } catch {
    return {};
  }
}

export function setDeviceMapping(deviceId: string, recordingProfileId: string): void {
  if (typeof window === "undefined") return;
  const map = readDeviceMap();
  map[deviceId] = recordingProfileId;
  window.localStorage.setItem(DEVICE_MAP_KEY, JSON.stringify(map));
}
