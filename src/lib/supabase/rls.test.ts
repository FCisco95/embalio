import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Live-integration test: it creates real users and writes to the live Supabase
// project, so it is OFF by default — even when creds are present — and must be
// opted into explicitly with RUN_RLS_INTEGRATION=1 (e.g. a dedicated test DB).
// This keeps `npm test` from polluting the live DB. The read-isolation gate this
// asserts is still RED pending multi-tenant read-RLS (tracked in the auth lane).
const hasCreds = Boolean(url && anon && service);
const runIntegration = process.env.RUN_RLS_INTEGRATION === "1" && hasCreds;

async function makeUser(email: string) {
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: "passw0rd!", email_confirm: true,
  });
  if (error || !created.user) throw new Error(error?.message ?? "createUser failed");
  const client = createClient(url!, anon!, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: "passw0rd!" });
  return { client, userId: created.user.id };
}

describe.skipIf(!runIntegration)("RLS isolation", () => {
  let a: Awaited<ReturnType<typeof makeUser>>;
  let b: Awaited<ReturnType<typeof makeUser>>;
  beforeAll(async () => {
    a = await makeUser(`a_${Date.now()}@test.dev`);
    b = await makeUser(`b_${Date.now()}@test.dev`);
  });

  it("user B cannot read user A's profile", async () => {
    // user_id must be set to the owner: the "own profiles" RLS policy's WITH CHECK
    // requires user_id = auth.uid(), and the column has no auto-default.
    const { data: inserted, error: insErr } = await a.client
      .from("profiles")
      .insert({ handle: "@a", user_id: a.userId })
      .select()
      .single();
    expect(insErr).toBeNull();
    expect(inserted?.handle).toBe("@a");

    const { data: bSees } = await b.client.from("profiles").select("*");
    expect(bSees?.find((p) => p.id === inserted!.id)).toBeUndefined();
  });
});
