# Embalio — guarded RLS recovery

Prepared 2026-10-21. **Production execution is owner-only.** The agent has no
authenticated production connection and has not applied these scripts. The owner
ran the reviewed bundle and supplied the passing postflight below; app login and
refreshed Advisor acceptance remain pending.

## Confirmed Production Evidence

The owner supplied the read-only preflight result, checked as `postgres` on
PostgreSQL **17.6** at **2026-10-21 15:51:26 UTC**:

- All 19 named tables had RLS disabled, no policies, and full direct privileges
  for `anon`, `authenticated` and `service_role`; all are owned by `postgres`.
- No custom/column grants or role memberships were reported for these roles.
- Six profiles existed: four had no Auth owner; none pointed at a missing Auth
  user. The unique `fcisco95` profile was unlinked. Existing nonempty child tables
  had no null/unmatched profile references. No other public tables were RLS-off.
- The Auth Users screenshot showed test accounts. The owner then created their
  own Auth user and supplied its UUID privately; it is not stored in Git files.
  The link script checks existence and confirmed email again before writing.

This proves the pre-recovery authorization defect, not whether data was accessed by an
outsider. The two warnings and two informational Advisor findings were not expanded.

## Scripts and Execution Order

| Stage | Portable source | Effect |
|---|---|---|
| Read-only preflight | `docs/security/2026-10-21-rls-preflight.sql` | Metadata, effective privileges, owner and child-reference counts |
| 1. Temporary containment | `docs/security/2026-10-21-rls-containment.sql` | Revoke `PUBLIC`/`anon` rights on the 19 tables; retain existing authenticated/service CRUD |
| 2. Primary owner link | `docs/security/2026-10-21-link-primary-owner.sql` | Fill only the unique, currently unlinked `fcisco95` profile's owner |
| 3. RLS recovery | `docs/security/2026-10-21-rls-recovery.sql` | Enable RLS, owner policies, internal-table denial and effective-grant checks |
| 4. Read-only receipt | `docs/security/2026-10-21-rls-verify.sql` | Compact post-application checks |

The private, prefilled operator copy on this machine is
`.superpowers/security-recovery/2026-10-21/apply-reviewed-rls.sql` (Git-ignored).
It concatenates stages 1–4 with the owner-supplied Auth UUID and explicit
`quarantine_unlinked_profiles := true`. It contains independent transactions:
containment remains if a later stage fails. Stop and report the exact error.

Portable templates leave the expected owner UUID null so accidental execution
fails. Regenerate the private copy from these sources when switching machines;
obtain the expected UUID independently from Authentication → Users. Do not infer
ownership from the exposed profile rows or copy account IDs into public commits.

Containment is **temporary**: authenticated access remains broad until recovery.
It is not a substitute for RLS and does not establish safe Auth signup settings.

## Intended Access After Recovery

| Model | Tables |
|---|---|
| Authenticated owner CRUD | `profiles`, `seed_targets`, `candidates`, `drafts`, `posts`, `posting_accounts`, `posting_jobs`, `research_briefings`, `watch_targets`, `sniper_alerts`, `push_subscriptions` |
| Service-role only | `signal_tweets`, `tweet_metric_snapshots`, `activity_events`, `topic_history`, `follower_snapshots`, `analytics_daily`, `predictions`, `strategy_snapshots` |

The primary link does not overwrite another owner or change another profile.
Explicit quarantine preserves the other NULL-owner profiles and all their data;
authenticated sessions cannot see them. Service-role jobs still can process them.
Existing test-owned profiles keep their existing owners. No Auth user is disabled
or deleted; no profile/data is deleted, and no owner is guessed.

Recovery rejects unknown table owners/grantees, unexpected restrictive policies,
invalid owner links/child keys, wrong defaults, bypass roles and surviving
effective anonymous or inappropriate authenticated privileges. Final checks run
after every grant, including the case where `anon` inherits `authenticated`.
An absent `profiles.user_id` default is restored to the schema's `auth.uid()`.
Historical text `research_briefings.profile_id` is not converted during recovery.

## Local Verification and Review

`scripts/check-rls-recovery.mjs` creates its own cached PostgreSQL 17 container,
with no network, host ports or host data mounts, then removes only that exact
container after checking its ownership label. It never reads app credentials.

Verified commands:

```text
node scripts/check-rls-recovery.mjs
node scripts/check-rls-recovery.mjs --containment
node scripts/check-rls-recovery.mjs --link-owner
node scripts/check-rls-recovery.mjs --bundle .superpowers/security-recovery/2026-10-21/apply-reviewed-rls.sql
```

RED was observed for public profile reads, missing owner linking, quarantine
without an explicit guard, inherited/custom rights, bad defaults and incorrect
owner associations. GREEN covers 19-table anonymous denial, two-user isolation,
own CRUD, foreign insert/update/delete rejection, service access, idempotency,
quarantined-data preservation, 18 atomic refusal scenarios and the complete
operator sequence. The operator sequence uses a synthetic Auth UUID in the fixture.

A read-only reviewer checked the SQL and runner. Findings about inherited grants,
final-check ordering, owner identity and child references were fixed and
re-reviewed. Final scoped review found no Critical/Important defect.

**Limits:** this is real PostgreSQL authorization against a reduced fixture,
including a local `auth.uid()` stand-in. It does not verify live Supabase sessions,
PostgREST, production triggers/FKs/views/privileged RPCs, all retained policy
dependencies, Auth signup configuration or whether an intrusion occurred.

## Owner-Run Production Receipt

The owner supplied the final JSON checked at **2026-10-21 16:17:25.019601 UTC**.
It is preserved verbatim in `docs/security/2026-10-21-rls-postflight.json`:

- All 19 expected tables were found and all 19 have RLS enabled.
- Anonymous accessible tables: **0**.
- Authenticated internal-table access and administrative privileges: **0**.
- Expected primary Auth owner verified: **true**.
- Profiles preserved: **6**; unlinked profiles: **3**, down from four.

This is owner-supplied database metadata, not an independent agent production
query or authenticated app acceptance. It confirms the intended table/grant/owner
postflight. The owner UUID is omitted from the portable receipt and templates.

## Production Acceptance Still Required

Refresh Security Advisor / rerun its linter, then sign into the app as the real
owner and verify the expected profile, queue and performance data. Do not report
full app acceptance from the SQL receipt alone. This does not apply the five October
revamp migrations, merge PR #7, connect X, or unblock slice 2 automatically.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[PostgreSQL policy composition](https://www.postgresql.org/docs/17/sql-createpolicy.html),
[PostgreSQL privilege revocation](https://www.postgresql.org/docs/17/sql-revoke.html).
