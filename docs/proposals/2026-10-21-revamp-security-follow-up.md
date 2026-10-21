# Proposed Linear child issue

Status: one child issue approved on 2026-10-21. The owner asked the agent to find
the parent; current BAK inventory is accessible but has no suitable parent.
Explicit approval of the same single issue independently is pending. No issue
has been created; do not create another parent or use an unrelated issue.

Title: **Embalio: harden Server Actions and manual publish confirmation**

Labels: `agent-proposed`, existing `Embalio` label.
Team: Bakehouse Labs / BAK (workspace Bakehouse Labs).
Do not change priority, assignee or estimate.

## What Was Found

1. Slice 1 moved cron/service-role cores out of several Server Action modules,
   but other `"use server"` modules importing `supabaseService` still need an
   exported-action audit. The audit must distinguish an ownership-gated action
   from an unauthenticated service-role entry point.
2. `src/server/target-queue.ts:12` exports `recommendTargets` from a
   `"use server"` module and invokes LLM research without a session check. An
   unauthenticated request could incur generation cost even without reading DB data.
3. `src/lib/schemas.ts:9` checks tweet URLs with an unanchored hostname/path
   expression. Host lookalikes such as `https://notx.com/a/status/1` can match.
   This schema is used by manual posting and `confirmPublished`.
4. `src/components/approval-queue.tsx:210` lets the operator resolve an
   `unconfirmed` draft. It does not explain that a missing link reply is not
   recreated by `src/server/queue-actions.ts:182` (`confirmPublished`).

## Acceptance Criteria

- Inventory exported Server Actions in modules using the service client.
  Keep service-role cores in plain `server-only` modules with authenticated,
  ownership-checked wrappers where user actions are needed.
- Unauthenticated calls cannot reach paid LLM generation through
  `recommendTargets`; retain an explicit server-only path for cron callers.
- Tweet URL validation accepts the intended X/Twitter hosts and tweet paths,
  rejects hostname lookalikes, and has regression cases for both valid and
  invalid URLs at the public schema boundary.
- The unconfirmed card clearly tells the operator that any missing link reply
  must be handled manually. Do not add an automatic retry of an uncertain post.
- Use RED → GREEN tests for each fix, then the full suite, TypeScript and build.
  Do not change publishing scope, apply migrations or alter credentials.

## Duplicate Search / Authority

Renewed Orca searches covered the now-connected Bakehouse workspace. `Embalio`
returned only completed BAK-5 (Orca bridge smoke test); `revamp` matched unrelated
ORG-3 (Organic auth emails); `recommendTargets`/`TweetUrl` returned no matches.
Full BAK inventory including archived returned five issues, `hasMore=false`,
`truncated=false`, `partial=false`: onboarding BAK-1..4 and completed BAK-5.
Projects returned none. Existing `agent-proposed` and `Embalio` labels are readable.

The owner asked the agent to verify rather than supplying a parent. No suitable
parent exists in that inventory. Permission for exactly one independent BAK issue
is pending; re-check duplicates at creation. This proposal does not authorize
beginning implementation, setting priority/assignee/estimate or creating a parent.
