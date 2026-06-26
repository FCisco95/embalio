# Plan — Signal warehouse retention/purge (GDPR LIA R1)

**Date:** 2026-06-26 · **Driver:** GDPR LIA §5 **R1** (`docs/compliance/2026-06-24-gdpr-lia-signal-warehouse.md`)
**Status:** approved-to-build · freeze-safe (touches neither P4 Predictions nor P6 Strategy)
**Gate context:** R1 is a stated **prerequisite before scaling `signal_tweets` beyond the GATE-2 dogfood**. Until it ships, the Art. 6(1)(f) balancing test is weaker (indefinite third-party retention).

## Problem

`signal_tweets` (third-party public tweets warehoused by the sniper/targeting/tracking crons)
accumulates **indefinitely**. The `deleted_at` column exists but is **never written**; no purge job
runs. GDPR Art. 5(1)(e) storage-limitation requires a retention bound.

## Decision record (do not re-litigate)

1. **Hard-delete, not soft-delete.** Reads (`board.ts` 48h window, `heat.ts` 24h windows) do **not**
   filter `deleted_at`, and both already exclude rows older than the retention window by their own
   time bounds. Setting `deleted_at` would therefore be functionally inert **and** would fail
   storage-limitation (data physically retained). Hard `DELETE` achieves true erasure. The
   `deleted_at` column is left in place (vestigial; harmless) but intentionally unused. *Do not
   "fix" this back to soft-delete without re-reading this paragraph.*
2. **Retention window = 90 days** (LIA-proposed), env-overridable via `SIGNAL_RETENTION_DAYS`
   (mirrors `SNIPER_MIN_SCORE` / `GEMINI_MODEL` override convention). Default baked into code.
3. **Anchor on `first_seen_at`**, NOT `last_seen_at`. `first_seen_at` is the true
   first-collection timestamp: `toSignalTweetRow` omits it, so the upsert never overwrites it on a
   re-sighting. `last_seen_at` refreshes on every re-scrape → a popular re-seen tweet would never
   age out (retention clock would never start). 90 days from first collection, hard cap.
4. **Cascade handles `tweet_metric_snapshots`.** FK `signal_tweet_id references signal_tweets(id)
   on delete cascade` (migration `20260611_signal_warehouse.sql:24`) → deleting a warehouse row
   auto-deletes its metric snapshots. No separate snapshot purge. **No migration needed.**
5. **Separate workflow file** `signal-retention.yml` (mirror `sniper-poll.yml`), NOT a new schedule
   inside `signal-crons.yml` — adding a 3rd schedule there would require rewriting every existing
   step's `if: github.event.schedule != …` guard (silent-misfire risk). Isolation is safer.
6. **Cron fails loud.** Unlike `warehouseTweets` (fire-and-forget, returns 0), the purge route must
   return non-200 on DB error so GitHub Actions surfaces it. Core throws on error; route catches → 500.

## Deliverables

### T1 — pure retention core (TDD) · `src/lib/signals/retention.ts` (+ `.test.ts`)
- `RETENTION_DAYS_DEFAULT = 90`; `retentionDays()` reads `SIGNAL_RETENTION_DAYS` (parse int, fall
  back to default on unset/NaN/≤0).
- `retentionCutoffIso(now: Date, days = retentionDays()): string` — pure: `now − days` → ISO string.
- `purgeExpiredSignals(sb, opts?: { now?: Date; days?: number }): Promise<{ deleted: number; cutoff: string }>`
  — `sb.from("signal_tweets").delete().lt("first_seen_at", cutoff).select("id")`; returns count +
  cutoff. **Throws** on supabase error (loud). Pure date logic isolated for testing.
- Tests (boundary-mocked, mirror `warehouse.test.ts`): cutoff math with a fixed `now`; env override
  (90 default, custom value, garbage→default); delete chain called with the right `.lt` column +
  cutoff; throws on mocked error; returns `data.length`.

### T2 — cron route · `src/app/api/cron/signal-retention/route.ts` (+ `.test.ts`)
- **Mirror an existing cron route exactly** (`src/app/api/cron/sniper/route.ts` /
  `…/strategy/route.ts`) for the Next.js route-handler shape — do NOT trust training-data API shapes
  (see AGENTS.md; consult `node_modules/next/dist/docs/` only if deviating from the in-repo pattern).
- `GET(req)`: `cronAuthError(req)` gate → `supabaseService()` → `purgeExpiredSignals(sb)` →
  `NextResponse.json({ ok: true, deleted, cutoff }, { status: 200 })`. `try/catch` → log + 500
  `{ ok: false, error }`.
- Test mirrors `src/app/api/cron/strategy/route.test.ts`: mock `cron-auth` (401 path + ok path),
  `supabase/server`, and `signals/retention`; assert 200 body, 401 when unauthorized, 500 on throw.

### T3 — schedule wiring · `.github/workflows/signal-retention.yml`
- Copy `sniper-poll.yml`. `cron: "45 2 * * *"` (daily 02:45 UTC, low-traffic) + `workflow_dispatch`.
  Single step curls `/api/cron/signal-retention` with `CRON_SECRET` bearer; assert HTTP 200.

### T4 — env doc · `.env.example`
- Add `SIGNAL_RETENTION_DAYS=90` with a one-line comment (rolling warehouse retention, days).

### T5 — compliance + handoff docs
- `docs/compliance/2026-06-24-gdpr-lia-signal-warehouse.md`: R1 row ❌ Gap → ✅ **Shipped**; note
  mechanism (hard-delete 90d on `first_seen_at`, cascade snapshots, daily `signal-retention` cron,
  `SIGNAL_RETENTION_DAYS` override). Update §6 residual-risk line (R1 no longer dominant).
- `docs/HANDOFF.md`: add Session 17 entry — R1 retention shipped; remaining LIA conditions R2
  (privacy notice) + R3 (DSR runbook) still open, outward/owner-driven.

### T6 (stretch, only if suite stays green) — DSR helper (LIA R3)
- `purgeSignalsForHandle(sb, handle): Promise<{ deleted: number }>` in `retention.ts` — hard-delete
  `signal_tweets` for one `author_handle` (cascade snapshots); + a one-line runbook note in LIA R3.
  Keep tiny; skip if it risks T1–T5.

## Verification (house gate)
- `npx vitest run` → full suite green (675 + new tests).
- `npx tsc --noEmit` → 0 errors.
- Manual diff review by owner before commit. Commit direct-to-main (trunk policy), suite-green-gated.
  **Push + live cron activation owner-gated** (consistent with the cron/env posture).

## Out of scope
- No migration. No read-path changes. No change to `signal-crons.yml`. No live DB purge run from
  this session (the cron does it on schedule once activated). R2 (privacy notice URL) and R3 full
  runbook are outward/owner tasks tracked in the LIA, not this build.
