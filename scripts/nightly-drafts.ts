// GH Actions / local worker: write tomorrow's queue of ORIGINAL post drafts for every
// managed account (1-3 each, with angle + rationale), for approval from a phone.
// Builds its own service-role client — must NOT import src/lib/supabase/server
// (that module pulls next/headers, which dies outside a Next request).
// The orchestration lives in src/lib/engine/nightly-run.ts (testable, deps injected).
//
//   npx tsx scripts/nightly-drafts.ts [--profile <id>] [--dry-run] [--max <1-3>]
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";
import { generateStructured } from "../src/lib/generate";
import { notify } from "../src/lib/notify";
import { buildNotifyDeps } from "../src/server/notify-deps";
import { parseNightlyArgs } from "../src/lib/engine/nightly";
import { runNightly } from "../src/lib/engine/nightly-run";
import { laneScan } from "../src/lib/engine/xsearch";

async function main() {
  const args = parseNightlyArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient<Database>(url, key, { auth: { persistSession: false } });

  const { summary, exitCode } = await runNightly(args, {
    sb,
    generate: generateStructured,
    scan: laneScan,
    env: { xaiApiKey: process.env.XAI_API_KEY, xaiModel: process.env.XAI_MODEL },
    notify: async (profileIds, payload) => {
      const deps = buildNotifyDeps(sb);
      // Telegram is one chat; push subscriptions are per profile. Send once, to the union of them.
      const loadPushSubs = deps.loadPushSubs;
      deps.loadPushSubs = async () => {
        const seen = new Map<string, Awaited<ReturnType<typeof loadPushSubs>>[number]>();
        for (const id of profileIds) for (const s of await loadPushSubs(id)) seen.set(s.endpoint, s);
        return [...seen.values()];
      };
      await notify(profileIds[0], payload, deps);
    },
  });

  console.log(JSON.stringify(summary));
  if (exitCode) process.exitCode = exitCode;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
