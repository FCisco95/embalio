# Subscription Generation Spike — Findings (2026-05-27)

**Result: PASS — `GEN_BACKEND=subscription`.** The owner's Claude subscription drives generation headlessly, including live web research returning parseable JSON. No fallback to Gemini needed.

## Environment
- `claude --version` → `2.1.150 (Claude Code)`, on PATH at `C:\Users\joao_\AppData\Roaming\npm\claude`.

## Step 2 — plain headless generation (PASS)
Command: `claude -p "Write one short sentence about agentic AI. Plain text only."`
Output: a single clean sentence, exit 0. Print mode works non-interactively on the subscription.

## Step 3 — headless web research + JSON (PASS — the critical capability)
Command:
```
claude -p "Search the web for one recent development in agentic AI from the last 2 weeks. Respond with ONLY a JSON object: {\"headline\":\"...\",\"url\":\"...\"}. No prose, no markdown fences." --allowedTools WebSearch WebFetch
```
Output: `{"headline":"OpenAI and Dell announce Codex on-premises enterprise deployment for regulated industries","url":"https://www.digitalapplied.com/blog/agentic-ai-week-in-review-may-19-23-2026"}`, exit 0.

## Confirmed for the wrapper (plan Task 2)
- Backend: **subscription** (default). No `--dangerously-skip-permissions` or `--permission-mode` needed.
- Plain: `claude -p` (prompt via arg or stdin — wrapper will use stdin for long prompts).
- Research: append `--allowedTools WebSearch WebFetch`. This matches `buildClaudeArgs({ research: true })`.
- JSON came back clean and parseable; the `generateStructured` parse+retry layer is sufficient insurance.

## Implication
Generation is **free** (rides the subscription) and **local** (must run where `claude` is authenticated). The Vercel cron path remains incompatible with this — out of scope for the local engagement engine. Proceed with Tasks 2–11 as written.
