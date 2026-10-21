# Proposed Linear child issue

Status: creation approved on 2026-10-21; waiting for the owner to supply the
parent issue ID. Orca's connected team inventory does not expose Embalio/BAK.
No issue has been created. Do not create a root issue or use another team instead.

Title: **Harden Server Action boundaries and manual publish confirmation**

Label: `agent-proposed`.
Team: Embalio / BAK, subject to the supplied parent issue's verified identity.
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

Read-only Orca Linear searches for `Embalio`, `revamp`, `recommendTargets` and
`TweetUrl` returned no matches in the connected workspace search, with no
reported partial results. This does not establish that no issue exists in an
unconnected workspace. Verify the supplied parent and re-check duplicates before
creating exactly one child; ask if the parent is unavailable in the connected workspace.

Creation is approved; the parent ID is still missing. This proposal does not
authorize beginning its implementation.
