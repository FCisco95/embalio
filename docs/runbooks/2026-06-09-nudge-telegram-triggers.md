# Runbook — Phase 1b nudge + Telegram callback triggers

Branch: `feat/nudge-telegram-callback`. Built but not yet wired to a scheduler.

## Before going live (one-time)

Apply the additive migration to the live Embalio Supabase project
(`vzxpakxjnuaesfxihyvl`) — it is committed but intentionally **not** auto-applied:

```
supabase/migrations/20260609_profiles_retention.sql
  -> alter table profiles add column if not exists retention jsonb not null default '{}'::jsonb;
```

Apply via the Supabase MCP `apply_migration` or `supabase db push`. No new env vars
are needed beyond the already-set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and
`CRON_SECRET`.

## Local triggers (dogfood)

While `npm run dev` is up, a local scheduler (Windows Task Scheduler / launchd) hits these
with `Authorization: Bearer $CRON_SECRET`:

- `GET /api/telegram/poll` — every ~1 min. Drains Telegram Posted/Skip taps via getUpdates:
  **Posted** logs the reply (`markRepliedQuick`, ticks the coach quota + the posts-derived
  streak); **Skip** dismisses the candidate. Advances the stored `retention.telegram.offset`.
- `GET /api/nudge` — hourly. The route self-guards on the per-user `sendHour`
  (`retention.nudge.sendHour`, default 9), so hourly polling lands at most one loss-framed
  nudge/day. Silent opt-out after 5 ignored; any real action re-opts-in.

Both routes are cloud-safe (no `claude`), so they can later move into `vercel.json` crons
alongside `targeting`/`tracking`. We deliberately do **not** `setWebhook` — getUpdates and a
webhook are mutually exclusive, and the local poll keeps everything on the existing
local-only model.

## Smoke test (deliver-only)

1. Trigger a pulse so a Posted/Skip message lands in Telegram (existing flow).
2. Tap **Posted** on your phone.
3. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/telegram/poll`
   → `{ ok: true, applied: 1 }`; the candidate flips to `engaged` and a URL-less reply post
   appears (coach `repliesDoneToday` ticks).
4. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/nudge` at/after
   `sendHour` with no action today → a loss-framed Telegram message; `retention.nudge.lastSentDate`
   stamps so a second call the same day is a no-op.
