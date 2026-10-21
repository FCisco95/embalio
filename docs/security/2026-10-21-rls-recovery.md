# Embalio — guarded RLS recovery

Prepared 2026-10-21. **Production execution is owner-only.** The agent has no
authenticated production connection and has not applied these scripts. The owner
ran the reviewed bundle and supplied the passing postflight below. The owner's
screenshot confirms dashboard access. Refreshed Security Advisor shows zero
errors, two warnings and two suggestions before function hardening. The owner
then applied the guarded, reviewed/tested function fix and returned a passing
receipt. Final refreshed Advisor counts are **0 errors, 1 warning, 2 suggestions**.

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

## Production UI Acceptance and Remaining Limits

After opening the production site, the owner supplied a screenshot showing a
signed-in dashboard, `@fcisco95` selected, 20 drafts pending sign-off and existing
home cards. This confirms owner-observed login/home/profile visibility. It does
not exercise dedicated queue/performance routes, writes or tenant isolation.
The screenshot shows the existing published UI; the revamp PR remains unmerged.

The owner's subsequent Security Advisor screenshot shows **0 errors**, down from
19, with **2 warnings** and **2 suggestions** still present. Combined with the
postflight, this confirms resolution of the original table-RLS findings. The
owner then expanded both tabs:

| Finding | Assessment / next step |
|---|---|
| Function Search Path Mutable: `public.save_persona` | Owner applied `2026-10-21-save-persona-hardening.sql`. Receipt confirms reviewed body, pinned search path and SECURITY INVOKER. Final Advisor warning count dropped from two to one. The fix preserves the observed live behavior. |
| Leaked Password Protection Disabled: Auth | Supabase documents this feature as Pro-plan and above. The owner's project screenshot shows Free. Treat as an unavailable paid feature, not evidence that the new password was leaked; no plan/account change authorized or performed. |
| RLS Enabled No Policy: `public.algorithm_briefs` | Intentional service-role-only design in migration `0012_algorithm_briefs.sql`; server code uses `supabaseService`. Keep default denial for normal API roles. |
| RLS Enabled No Policy: `public.youtube_credentials` | Intentional service-role-only design in migration `0011_youtube_credentials.sql`; OAuth/publish server code uses `supabaseService`. Do not add a browser-access policy to silence the Info finding. |

The owner applied the function SQL; no agent production write or Auth setting
change was made for these findings.
Password storage and breach-list screening are separate: Supabase Auth stores
password hashes using bcrypt, including on Free. The paid protection additionally
rejects passwords already present in known breach lists; its disabled warning is
not evidence that this account's password leaked or that passwords are plaintext.
The two Info findings alone do not prove exposure; this is an access-model
assessment from source and the Advisor screenshot, not a fresh audit of all grants,
views or service-role entry points.

The final owner-supplied refreshed Advisor screenshot shows **0 errors, 1 warning,
2 suggestions**; counts/source are saved in `2026-10-21-advisor-postflight.json`.
The selected tab was Errors; the final warning row was not expanded. The remaining
count is consistent with the previously identified unchanged Pro-only Auth
warning and the intentional Info tables. The RLS/function remediation checkpoint
is accepted through the owner SQL receipts and UI read-back, within these limits.

Dedicated queue and performance data checks remain
untested. Do not report full application/security acceptance from the SQL receipt
and dashboard/Advisor screenshots alone. This does not apply the five October
revamp migrations, merge PR #7, connect X, or unblock slice 2 automatically.

## Reviewed save_persona Hardening — Owner Applied

The actual production code is preserved as owner-supplied read-back in
`docs/security/2026-10-21-save-persona-definition.json`. It updates the same
fields and seeds as migration 0006, but uses the original `profile % not found`
message and different formatting. The patch targets that observed body, not an
assumed migration match.

The owner ran `docs/security/2026-10-21-save-persona-hardening.sql` in Embalio's SQL
Editor. It changes the function definition, not application rows, roles or table
policies. It keeps `SECURITY INVOKER`, function identity, owner and existing ACLs.
Unknown body/overload/contract/settings or RLS-off owner tables abort the entire
transaction. Source hashes guard against accidental version drift; they are not
a substitute for database-owner authorization. No need to rerun the RLS bundle.

The owner returned final JSON with `function="public.save_persona"` and all three
booleans `security_invoker`, `search_path_pinned`, `reviewed_body` equal to **true**.
It is preserved verbatim in `docs/security/2026-10-21-save-persona-postflight.json`.
This is owner-supplied production metadata, not an independent agent query or
live persona save. The subsequent refreshed Advisor dropped from two warnings to
one, with zero errors and two Info suggestions. The unchanged Pro-only password
warning and intentional Info findings were classified above.
Do not rerun the function SQL just to verify the dashboard.

Local evidence:

```text
node scripts/check-save-persona-hardening.mjs --red
node scripts/check-save-persona-hardening.mjs
```

RED reproduced caller-controlled search-path redirection against the exact
owner-supplied body. GREEN uses disposable PostgreSQL 17, with no network, ports,
host data mounts or app credentials. It verifies hostile-schema/temp-table/
function shadowing resistance, own persona fields and seed dedup, foreign/
missing-user/anonymous denial, atomic seed-failure rollback, service-role access,
OID/owner/ACL preservation, idempotency, the receipt and nine atomic refusal cases.
Every owned container was removed. A read-only reviewer found no actionable
Critical/Important issue. This remains reduced-fixture database verification,
not live Supabase HTTP or a production save action.

Final app checks passed: 1,242 tests / 1 skipped, standalone TypeScript and
production build. One initial suite run alongside the build timed out an existing
`active-profile-actions` test at 5 seconds; its focused 3-test file and the full
suite passed once the build had finished. No source/test/timeout change was made
for that result.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[PostgreSQL policy composition](https://www.postgresql.org/docs/17/sql-createpolicy.html),
[PostgreSQL privilege revocation](https://www.postgresql.org/docs/17/sql-revoke.html),
[Function search path guidance](https://github.com/supabase/splinter/blob/master/docs/0011_function_search_path_mutable.md),
[Supabase password security / plan availability](https://supabase.com/docs/guides/auth/password-security),
[RLS with no policies](https://github.com/supabase/splinter/blob/master/docs/0008_rls_enabled_no_policy.md).
