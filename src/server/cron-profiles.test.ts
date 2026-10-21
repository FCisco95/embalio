import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { resolveCronProfiles } from "@/server/cron-profiles";

/** Thenable query builder recording the calls the helper makes. */
function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder = {
    select: (...a: unknown[]) => (calls.push(["select", ...a]), builder),
    order: (...a: unknown[]) => (calls.push(["order", ...a]), builder),
    eq: (...a: unknown[]) => (calls.push(["eq", ...a]), builder),
    then: (resolve: (v: typeof result) => unknown) => resolve(result),
  };
  const from = vi.fn(() => builder);
  return { sb: { from } as unknown as SupabaseClient<Database>, from, calls };
}

const req = (qs = "") => new Request(`https://x/api/cron${qs}`);
const ROWS = [
  { id: "p1", handle: "one" },
  { id: "p2", handle: "two" },
];

describe("resolveCronProfiles", () => {
  it("lists every profile oldest first when no ?profile= is given", async () => {
    const { sb, from, calls } = fakeClient({ data: ROWS, error: null });
    await expect(resolveCronProfiles(req(), sb)).resolves.toEqual(ROWS);
    expect(from).toHaveBeenCalledWith("profiles");
    expect(calls).toContainEqual(["select", "id, handle"]);
    expect(calls).toContainEqual(["order", "created_at"]);
    expect(calls.some(([k]) => k === "eq")).toBe(false);
  });

  it("narrows to the profile named by ?profile=", async () => {
    const { sb, calls } = fakeClient({ data: [ROWS[1]], error: null });
    await expect(resolveCronProfiles(req("?profile=p2"), sb)).resolves.toEqual([ROWS[1]]);
    expect(calls).toContainEqual(["eq", "id", "p2"]);
  });

  it("returns [] for an empty table", async () => {
    const { sb } = fakeClient({ data: null, error: null });
    await expect(resolveCronProfiles(req(), sb)).resolves.toEqual([]);
  });

  it("throws on a read error instead of pretending there are no profiles", async () => {
    const { sb } = fakeClient({ data: null, error: { message: "boom" } });
    await expect(resolveCronProfiles(req(), sb)).rejects.toThrow("boom");
  });
});
