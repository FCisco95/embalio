# Embalio quality sweep — 2026-11-13

## Scope and authority

We are coordinating Orca workers to improve the existing product's usability,
functional reliability and organization. The owner requested autonomous execution
without another requirements interview. We preserve the October revamp's product
direction; this is a quality pass, not authorization for production rollout.

## Verified starting point

- Local `main`: `28a2038`, clean before this plan, 41 commits ahead of `origin/main`.
- Remote base: `f544ac4`. PR #7 remains open, draft and currently non-mergeable.
- Prune branch: `chore/prune-docs` at `f453239`; preserve it and the restore tag.
- Current Orca workspace has no linked Linear issue. Do not create a root issue.
- The handoff records five unapplied revamp migrations and an unlinked X account.
  These production prerequisites have not been independently refreshed today.

## Work sequence

1. Establish the current test result and inspect four independent areas in parallel.
2. Rank concrete findings by user impact; assign each fix to exactly one worker.
3. Implement bounded fixes in isolated workspaces based on the inspected revision.
4. Review changes, integrate into an unpublished quality branch and run the gate.
5. Update the canonical handoff with evidence and remaining blockers.

## First-wave ownership

Workers initially inspect only; they do not change product code or commit.

| Worker | Inspection responsibility | Required evidence |
|---|---|---|
| UX | Hoje queue, navigation, account controls, mobile/keyboard/error states | Specific user flow, file locations, rendered evidence where possible |
| Queue | Queue actions, publishing state transitions, nightly draft inputs | Repro or test-backed findings; distinguish mocked from live proof |
| Accounts | Ownership guards, active-profile propagation, login/setup boundaries | Concrete caller-to-data paths; no production or credential operations |
| Architecture | Route/feature coverage, test gaps, stale organization | Feature matrix and small actionable fixes, not a broad rewrite |

The coordinator owns this plan, the handoff and integration. Implementation
assignments must name exact editable files before workers begin. Workers are not
alone: preserve other edits and request shared-file changes through the coordinator.

## Acceptance

- Each accepted defect has a concrete reproduction and proportionate verification.
- Relevant UI changes are inspected at phone and desktop sizes, including keyboard
  access and pending/error states. Fixture checks are identified as fixture checks.
- `npm test`, `npx tsc --noEmit` and `npm run build` pass on the integrated candidate
  before any commit. No duplicated full run without a changed candidate or new issue.
- We report prepared, verified, reviewed and deployed as separate states.

## Boundaries and parked work

- Never push or merge local `main`; it carries the unshipped revamp.
- No production migrations, `.env*` edits, secret handling, live posts, paid API calls,
  scheduled-job activation or account-policy changes in this sweep.
- Preserve existing features and the distinction between approved original posts
  and manual replies. Do not begin the gated slice 2 or slice 3 rollout.
- Do not delete unique work, change global tooling or edit the Obsidian vault.
- Use Orca for worker communication and every Linear action. Independent root issue
  creation and the existing security proposal remain outside this execution.

## Status

Orca run: `run_92230aaea821`. All four dispatches returned `state: ready`.

| Lane | Task | Dispatch |
|---|---|---|
| UX | `task_e7cc55a377a4` | `ctx_b0be56a9ef92` |
| Queue | `task_de50f2650338` | `ctx_ec729700634b` |
| Accounts | `task_61e71098e4d3` | `ctx_7f22d2188047` |
| Architecture / test diagnosis | `task_d6e29b9a0d05` | `ctx_8ed7cc8c110f` |

The unchanged-source baseline `npm test` exited 1 in 189.57 seconds: 1,156 passed,
6 timed out at 5 seconds, 1 skipped, plus 8 fork startup errors. This is not a
valid full-suite pass. The six failures were in `active-profile-actions`,
`targeting.split`, `trends`, `studio/algorithm-brief`, `studio/playbook` and
`studio/projects-playbook`. Eight component test files could not start workers.
The architecture worker has the priority diagnosis: rerun the affected files with
at most two workers, unchanged timeouts, and separate environment contention from
code defects. A host snapshot showed 367 Node processes using about 45.6 GB;
ownership and causality are unproven. Do not stop unrelated processes.

No product code changed. Worker reports will determine the implementation batch.
Orca delivers reports to the coordinator; follow wake messages rather than polling.
