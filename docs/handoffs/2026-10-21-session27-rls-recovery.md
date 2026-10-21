# Session 27 — production RLS incident checkpoint

2026-10-21. Canonical handoff: `docs/HANDOFF.md`.

## TL;DR / Next Action

The owner ran the prefilled security SQL. Their 16:17:25 UTC receipt passed:
19 tables RLS-on, zero anonymous access, primary Auth owner verified, six profiles
preserved and three unlinked/quarantined. **No agent production write was
performed.** The owner's subsequent screenshot confirms the signed-in dashboard
as `@fcisco95` with 20 drafts. Refreshed Advisor shows 0 errors (previously 19),
2 warnings and 2 suggestions. The owner supplied the live `save_persona` code;
the guarded hardening candidate is reviewed/tested. Next: owner runs
`docs/security/2026-10-21-save-persona-hardening.sql` and returns its final JSON. The
feature PR remains separate from security SQL execution; slice 2 is still paused.

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

The function candidate qualifies both owner tables and `pg_catalog.unnest`, pins
an empty search path and retains the observed live error/behavior and INVOKER.
Separate real PG17 RED/GREEN tests cover hostile schemas/temp objects, own fields,
seed dedup/atomic rollback, foreign/anon/missing-user rejection, service role,
identity/ACL preservation, idempotency, the receipt and nine guard refusals.
Read-only review found no actionable Critical/Important issue. No function patch
has been applied in production by the agent or reported by the owner yet.

## Production Receipt / Pending Acceptance

- `docs/security/2026-10-21-rls-postflight.json` preserves the owner-supplied
  production result at 2026-10-21T16:17:25.019601+00:00: 19 present/RLS-on,
  zero anonymous access, zero authenticated internal/admin privileges, primary
  owner verified, six profiles and three unlinked. No independent live query.
- Owner screenshot confirms login/home access as `@fcisco95`, 20 drafts and
  existing home cards. Dedicated queue/performance routes and writes are untested.
- Owner's refreshed Advisor screenshot confirms 0 errors, 2 warnings and
  2 suggestions. The original table-RLS findings are resolved. Expanded warnings:
  mutable search path in `public.save_persona`; leaked-password protection disabled
  (Pro-only per official docs, project Free). Info tables `algorithm_briefs` and
  `youtube_credentials` intentionally use default-deny/service-role access in source.
  Live definition is archived in `docs/security/2026-10-21-save-persona-definition.json`;
  candidate execution/receipt is pending. Intrusion status is unknown.
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
postflight/function-definition JSON, guarded function candidate and runner, this
snapshot, canonical handoff update, and the private ignored
operator copy. No secret,
deployed resource or scheduled job was created by the agent. The owner created
their own Supabase Auth user directly.

## Next-Session Prompt

```text
Read docs/HANDOFF.md and docs/security/2026-10-21-rls-recovery.md.
Owner metadata confirmed 19 exposed tables and an unlinked primary profile.
Owner-run four-stage SQL passed its postflight; dashboard login is owner-confirmed.
Refreshed Advisor shows 0 errors, 2 warnings and 2 suggestions; findings are classified
in the runbook. Live save_persona code was received; candidate application/read-back
awaits the owner.
Dedicated queue/performance checks remain untested.
Model: GPT-6.1 Sol (high) — security verification and bounded follow-through.
Skills: task-observer, embalio, handoff-memory, supabase, supabase-security,
supabase-postgres-best-practices, verification-before-completion.
Inspect the saved owner receipt and current repo state. Obtain the result from
docs/security/2026-10-21-save-persona-hardening.sql and refresh Advisor; stop on
any guard error. Do not blindly rerun production SQL. Keep original Claude
session/transcript read-only, main/env/migrations untouched, and slice 2 paused.
```
