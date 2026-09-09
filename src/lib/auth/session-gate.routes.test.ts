import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { isProtectedPath } from "@/lib/auth/session-gate";

// Structural guard: every route under src/app/(app) must be behind the gate.
// Server actions resolve per page bundle (next/dist/server/app-render/
// manifests-singleton.js: workers[normalizeWorkerPageName(page)]), so an (app)
// route left out of isProtectedPath would let its actions run unauthenticated
// via a POST to that path — the proxy passes it, the action executes before
// the layout's requireCurrentProfile() ever runs.
const APP_DIR = path.resolve(__dirname, "../../app/(app)");

function routeSegments(dir: string): string[] {
  return readdirSync(dir).filter((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() && !name.startsWith("(") && !name.startsWith("_");
  });
}

describe("session gate covers every (app) route", () => {
  it("protects the (app) root", () => {
    expect(isProtectedPath("/")).toBe(true);
  });
  it.each(routeSegments(APP_DIR))("protects /%s", (segment) => {
    expect(isProtectedPath(`/${segment}`)).toBe(true);
    expect(isProtectedPath(`/${segment}/anything`)).toBe(true);
  });
  it("finds the (app) routes it is guarding (sanity: the directory scan is not empty)", () => {
    expect(routeSegments(APP_DIR).length).toBeGreaterThanOrEqual(8);
  });
});
