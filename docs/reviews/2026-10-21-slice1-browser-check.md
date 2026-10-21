# Slice 1 — browser check

Date: 2026-10-21. Source: `bfbc56f` on `feat/revamp-slice0-contract`.
PR: https://github.com/FCisco95/embalio/pull/7 (draft).

## Scope and Result

The requested layout checks passed in Chrome using the installed Playwright
driver. Real `AppShell`, `Sidebar`, `AccountSwitcher`, `ApprovalQueue` and
`XOAuthBanner` components were rendered with disposable fixture props and the
app's actual global CSS. No product CSS change was necessary.

| Check | Result | Evidence |
|---|---|---|
| Sidebar expanded, account menu open | Pass | Menu extends beyond the 236 px sidebar; corner hit tests remain inside its listbox |
| Sidebar collapsed, account menu open | Pass | Menu extends beyond the 68 px rail; all sampled corners remain clickable |
| Hoje queue at 390 × 844 | Pass | Both cards fit within x=18..372; client/scroll widths both 352 px |
| Queue buttons at 390 px | Pass | Publicar agora, Agendar, Saltar, Publicado and Não publicado all pass trial clicks and remain within viewport |
| OAuth mismatch banner | Pass | Query props `x=mismatch&handle=a&expected=b&profile=<fixture-id>` render both handles and the force-link URL |
| Authenticated `/` and `/profiles` route wiring | Skip | A fresh browser context redirects to `/login`; no local authenticated session was available |
| Real account switching / OAuth / publishing | Not exercised | Requires authenticated state and live configuration; outside this visual check |

No browser page errors were captured in the fixture run. The development-only
Next toolbar overlapped the collapsed footer on the first automation attempt;
it was hidden in the test page only, to match production geometry. Component
animations were allowed to finish before geometry and screenshots were recorded.

The fixture route was removed before verification/build and is not part of this
PR. No auth guard, production data, migration, environment file or live X state
was changed. Buttons were tested with Playwright's `trial` option, without
executing publishing actions.

Local-only screenshots and machine-readable results remain under
`.superpowers/browser-check/slice1/` (Git-ignored). This receipt is the portable
record; screenshot files are not required to resume.

## Cleanup Receipt

`git branch --merged feat/revamp-slice0-contract` included all three harness
branches. Each worktree was clean and its absolute path was checked to remain
under `.claude/worktrees/` before non-force removal.

| Removed worktree / branch | Integrated tip |
|---|---|
| `agent-a5b2abe2c6768f1d9` / `worktree-agent-a5b2abe2c6768f1d9` | `7afb6a6` |
| `agent-aaf3ac1cdb13defac` / `worktree-agent-aaf3ac1cdb13defac` | `b94f847` |
| `agent-ad02b055c09a50605` / `worktree-agent-ad02b055c09a50605` | `ccd06eb` |

`git worktree list` now contains only the primary checkout; no
`worktree-agent-*` branches remain. Local and remote `main` remain at `f544ac4`.
No empty cleanup commit was made.
