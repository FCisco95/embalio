import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function makeUser(email: string) {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  await admin.auth.admin.createUser({ email, password: "passw0rd!", email_confirm: true });
  const client = createClient(url, anon, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: "passw0rd!" });
  return client;
}

describe("RLS isolation", () => {
  let a: Awaited<ReturnType<typeof makeUser>>;
  let b: Awaited<ReturnType<typeof makeUser>>;
  beforeAll(async () => {
    a = await makeUser(`a_${Date.now()}@test.dev`);
    b = await makeUser(`b_${Date.now()}@test.dev`);
  });

  it("user B cannot read user A's profile", async () => {
    const { data: inserted } = await a.from("profiles").insert({ handle: "@a" }).select().single();
    expect(inserted?.handle).toBe("@a");
    const { data: bSees } = await b.from("profiles").select("*");
    expect(bSees?.find((p) => p.id === inserted!.id)).toBeUndefined();
  });
});
