// GH Actions / local worker: regenerate the topic board for every profile.
// Builds its own service-role client — must NOT import src/lib/supabase/server
// (that module pulls next/headers, which dies outside a Next request).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";
import { generateTopicBoard } from "../src/lib/topics/board";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient<Database>(url, key, { auth: { persistSession: false } });

  const { data: profiles, error } = await sb.from("profiles").select("id, handle");
  if (error) throw new Error(error.message);
  if (!profiles || profiles.length === 0) {
    console.log("no profiles — nothing to do");
    return;
  }

  let failed = 0;
  for (const p of profiles) {
    try {
      const n = await generateTopicBoard(sb, p.id);
      console.log(`board written: @${p.handle} → ${n} topics`);
    } catch (e) {
      failed++;
      console.error(`board FAILED: @${p.handle}:`, e instanceof Error ? e.message : e);
    }
  }
  if (failed === profiles.length) {
    process.exitCode = 1; // all failed = job failure; partial success keeps the green
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
