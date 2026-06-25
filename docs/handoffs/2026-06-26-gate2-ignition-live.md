# Snapshot — 2026-06-26 — GATE-2 ignition LIVE, dogfood armed

Point-in-time snapshot. Canonical living handoff: **`docs/HANDOFF.md`** (Session 16 has the full detail). This file is the archive of where things stood at session end.

## TL;DR

GATE-2 went from *can't-physically-start* → **live + armed**. All three config gaps fixed and executed against live infra this session: migration applied, prod deployed with `REPLY_INTENT_ENABLED=1`, 6 in-band watch handles seeded, relevance niche recalibrated to the owner's real niche. Poll pipe confirmed (`pulled:18`). No alert has fired yet — and that's **timing, not a bug**: every post polled was hours-stale in the late-evening lull. **STEP 5 (first real alert end-to-end) is the only remaining DoD item**, and it fires when the schedule catches a *fresh* viral post *in-window*.

## What is live (applied to infra, not just committed)

| Thing | State |
|---|---|
| Migration `20260622_sniper_manual_send` | ✅ applied to live Supabase (`vzxpakxjnuaesfxihyvl`, version `20260624215645`) |
| `REPLY_INTENT_ENABLED=1` | ✅ set on Vercel prod (code check strict `=== "1"`, `sniper.ts:95,288`) |
| Deploy | ✅ `origin/main` pushed; prod on new code (200, `npm run build` green) |
| Seed — 6 in-band `watch_targets` | ✅ `kaixcreator`, `heymike777`, `w3_surfer`, `dom_gag_96`, `saadpastadev`, `sahilpanhotra`; 4 oversized retired |
| Niche recalibration | ✅ `profiles.niche_description` + `content_pillars` → AI-dev-tooling-first |
| Poll pipe | ✅ `pulled:18` (2 manual `gh workflow run sniper-poll.yml`) |

Owner profile `FCisco95` = id `7a728122-569a-4db0-8773-1e537fd1a92f`, ~1,311 followers → 2–10× band = 2,622–13,110.
Verified real counts: `heymike777` 2,680 (2.0×), `KaiXCreator` 9,492 (7.2× — in-band, NOT oversized). Other 4 quiet this window; no prune needed.

## What to do next (priority order)

1. **⭐ Widen the poll window** — highest leverage. Cron `*/15 6-22 UTC` (`.github/workflows/sniper-poll.yml`, owner-locked) misses US-prime (~20:00–04:00 UTC) when the best targets (esp. KaiXCreator) post viral. The 16,768-view Kai post that proves the model was polled ~18h stale because it landed outside the window. Widen toward 24h (`*/15 * * * *`); cost ~64→96 Apify runs/day. **Owner-locked → confirm before changing.**
2. **STEP 5** — let the schedule catch a fresh Kai-class post → real alert (PWA + Telegram) → manual reply via X composer → confirm `sniper_alerts.status='acted'`, `sent_at`, `sent_reply_text`.
3. **Dogfood 7–10 days**, judged on the reach scorecard: visits/day +≥25% traceable to reply days; ≥3 replies each clearing ≥2× the author's median reply impressions; precision ≥70%.
4. **GDPR LIA condition R1** — ship `signal_tweets` retention/purge before scaling past the dogfood (`deleted_at` is never written today → permanent warehousing). See `docs/compliance/2026-06-24-gdpr-lia-signal-warehouse.md`.
5. **Watch-list tuning** — `heymike777` is mostly low-signal replies; consider swapping for an AI-dev/Claude-ecosystem account (the proven reach lane). Add more in-band AI-tooling handles via Grok.
6. **Recruit 3 strangers** — top schedule risk vs the **2026-09-04** deadline. Week-6 anti-burnout tripwire armed ~2026-07-30.

## Do NOT (frozen / out of scope)

P4 Predictions · P6 Strategy Engine · YouTube Phase-1 UI — all FROZEN (no investment until GATE-2 clears). No X API write / no automation post — manual-send only (a ban ends the project). Don't turn cron-side drafting into a hard dependency. See spec §9 scope fence.

## Suggested skills (next session)

- **`handoff-memory`** — resume / reconstruct context (auto-loads `docs/HANDOFF.md`).
- **`superpowers:systematic-debugging`** — if STEP 5 misfires (e.g. alert never lands, draft null, notify fails).
- **`promptfoo`** — before touching the relevance/scoring or draft-generation quality.
- **`supabase-security`** — when P7 RLS hardening starts (~17 service-role tables, currently RLS-disabled — post-gate).

## References

- Canonical: `docs/HANDOFF.md` (Session 16 = full live-ignition record).
- Audit checklist: `docs/superpowers/notes/2026-06-23-gate2-ignition-reconciliation.md`.
- Plan: `docs/superpowers/plans/2026-06-22-sniper-tos-redesign.md`.
- LIA: `docs/compliance/2026-06-24-gdpr-lia-signal-warehouse.md`.
- Full strategy report (vault): `cisco-brain/10 - PROJECTS/Embalio/research/Embalio — Improvement Report (2026-06-23).md`.
