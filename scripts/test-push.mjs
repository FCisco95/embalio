// One-off web-push smoke test (P5 dogfood). Run: node --env-file=.env.local scripts/test-push.mjs
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth");
if (error || !data?.length) throw new Error(`no subscriptions: ${error?.message}`);

webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
for (const s of data) {
  await webpush.sendNotification(
    { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
    JSON.stringify({ title: "🎯 Sniper test", body: "Web push channel live — P5 dogfood.", url: "/engage" }),
  );
  console.log("sent →", s.endpoint.slice(0, 50));
}
