# Session 27 — production RLS incident checkpoint

2026-10-21. Canonical handoff: `docs/HANDOFF.md`.

## TL;DR / Next Action

The owner ran the prefilled security SQL. Their 16:17:25 UTC receipt passed:
19 tables RLS-on, zero anonymous access, primary Auth owner verified, six profiles
preserved and three unlinked/quarantined. **No agent production write was
performed.** Next: confirm app login and refresh Security Advisor. The feature
PR remains separate from security SQL execution; slice 2 is still paused.

Read `docs/security/2026-10-21-rls-recovery.md` for evidence, scripts and acceptance.
The owner-provided read-only receipt confirmed PostgreSQL 17.6, 19 RLS-off tables,
no policies, anonymous/authenticated full grants, six profiles, four unlinked,
including `fcisco95`, and no orphan owner/child links. Auth Users showed test
accounts only; the owner then created their own account and supplied its UUID.
The UUID is kept out of tracked artifacts.

## Prepared / Verified

Portable templates under `docs/security/` provide temporary anonymous containment,
primary-only owner linking, owner/service RLS with explicit quarantine, and
read-only preflight/postflight. The guarded owner link refuses a different
existing owner, duplicate handle, missing or unconfirmed auth user.

The private prefilled copy is
`.superpowers/security-recovery/2026-10-21/apply-reviewed-rls.sql` (ignored).
It has independent transactions: if a later stage fails, containment remains.
It preserves other NULL-owner profiles/data in authenticated-invisible quarantine;
service jobs retain access. Existing test-owned profiles/accounts are untouched.

Real disposable PostgreSQL 17 tests pass: anonymous denial across 19 tables,
two-user CRUD isolation, service compatibility, idempotency, explicit quarantine,
18 atomic refusal scenarios, owner-link refusals and the four-stage bundle with
a synthetic identity. Read-only review found no remaining Critical/Important
issue after fixes. This is not full-schema or live Supabase API verification.

## Production Receipt / Pending Acceptance

- `docs/security/2026-10-21-rls-postflight.json` preserves the owner-supplied
  production result at 2026-10-21T16:17:25.019601+00:00: 19 present/RLS-on,
  zero anonymous access, zero authenticated internal/admin privileges, primary
  owner verified, six profiles and three unlinked. No independent live query.
- Refresh the Advisor and sign into the app as the owner. The original
  two warnings/two info items were not reviewed; intrusion status is unknown.
- Never merge/push `main`, edit `.env*`, apply migrations as the agent, delete
  auth users or infer ownership of remaining profiles. Original Claude session,
  pane and transcript remain read-only; never alter/delete its transcript file.
- The approved Linear follow-up still needs its parent ID and Embalio/BAK
  connection. Slice 2 still needs explicit PR-merge AND `@fcisco95` X-link confirmation.

## Suggested Skills

`task-observer`, `embalio`, `handoff-memory`, `supabase`, `supabase-security`,
`supabase-postgres-best-practices`, `verification-before-completion`, `handoff`.

## Generated Artifacts

SQL templates, security runbook, `scripts/check-rls-recovery.mjs`, owner-supplied
postflight JSON, this snapshot, canonical handoff update, and the private ignored
operator copy. No secret,
deployed resource or scheduled job was created by the agent. The owner created
their own Supabase Auth user directly.

## Next-Session Prompt

```text
Read docs/HANDOFF.md and docs/security/2026-10-21-rls-recovery.md.
Owner metadata confirmed 19 exposed tables and an unlinked primary profile.
Owner-run four-stage SQL passed its postflight; app/Advisor acceptance is pending.
Model: GPT-6.1 Sol (high) — security verification and bounded follow-through.
Skills: task-observer, embalio, handoff-memory, supabase, supabase-security,
supabase-postgres-best-practices, verification-before-completion.
Inspect the saved owner receipt and current repo state. Confirm app login and
refreshed Advisor results; do not blindly rerun production SQL. Keep original Claude
session/transcript read-only, main/env/migrations untouched, and slice 2 paused.
```
