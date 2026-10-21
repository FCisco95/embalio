---
name: embalio-nightly
description: Run or inspect the Embalio nightly drafts job; use when asked to "gerar drafts", "nightly drafts", or about "fila de amanhã" (tomorrow's approval queue).
---

# embalio-nightly

Every morning (06:30 UTC = 07:30 Lisbon in summer, 06:30 in winter; GitHub Actions) the job writes 1-3 ORIGINAL post drafts per managed
account into `drafts`, each with an `angle`, a `rationale` and a suggested Lisbon posting time
(`scheduled_at`). The operator approves them from a phone. It never posts. It sends ONE combined "queue ready"
notification per run (e.g. "A tua fila está pronta: @a (3), @b (2)"), only when at least one draft
was written and never on `--dry-run`.

Code: `scripts/nightly-drafts.ts` (thin entry, real deps), `src/lib/engine/nightly-run.ts` (orchestration,
deps injected, tested), `src/lib/engine/nightly.ts` (pure helpers),
`src/lib/engine/xsearch.ts` (xAI lane scan), `buildNightlyDraftsPrompt` in `src/lib/voice-prompt.ts`.

## Run locally

```bash
npx tsx scripts/nightly-drafts.ts --dry-run            # print insert payloads, write + notify nothing
npx tsx scripts/nightly-drafts.ts --dry-run --profile <profile-id>
npx tsx scripts/nightly-drafts.ts --max 2              # real run, 1-3 drafts per profile (default 3)
```

Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (required); the `claude` CLI logged in
(`GEN_BACKEND=subscription`, default); `XAI_API_KEY` + optional `XAI_MODEL` (default `grok-4.7`)
for the 24h lane scan, skipped when unset; Telegram / VAPID vars for the "queue ready" notification.
With a local env file: `npx tsx --env-file=.env.local scripts/nightly-drafts.ts --dry-run`.

## Rules it enforces

- Eligible profile = has a `voice_spec` or content pillars; others are skipped and logged.
- Idempotent: a profile with >= `max` original drafts in status `draft` from the last 20h is skipped ("queue full").
- Net-new angles only: the prompt lists the last 30 posted drafts, pending drafts and `voice_corpus`
  as do-not-rephrase, and drafts with word-set Jaccard >= 0.6 against any of them are dropped before insert.
- Body <= 280 chars (4000 on `premium_account`); no URL in the body (links go to `link_url`); non-empty angle and rationale.
- Rejected drafts are dropped and logged, never re-prompted beyond the 2 generation attempts.
- Cost: one xAI `x_search` call per profile ($5 per 1k posts returned); the summary line reports `estimatedXaiCostUsd`.
- Exit code is 0 unless every eligible profile failed. Last line is a JSON summary
  `{ profiles, inserted, skipped, failed, estimatedXaiCostUsd }`.

## Run in CI

```bash
gh workflow run nightly-drafts.yml -f dry_run=true
gh workflow run nightly-drafts.yml -f profile=<profile-id> -f dry_run=true
gh run list --workflow nightly-drafts.yml --limit 3
```

Secrets: same as `refresh-topics` plus optional `XAI_API_KEY`, repository variable `XAI_MODEL`.
Migration `20261021_publish_xapi.sql` must be applied before a real (non-dry) run.
