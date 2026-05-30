import { spawn } from "node:child_process";
import { withRetry } from "@/lib/retry";

export interface RunnerOpts { research?: boolean }
export type CliRunner = (args: string[], stdin: string, timeoutMs?: number) => Promise<string>;

// Research calls (web tools) legitimately take longer than plain generation.
const DEFAULT_TIMEOUT_MS = 120_000;

export function buildClaudeArgs(opts: RunnerOpts): string[] {
  const args = ["-p"];
  if (opts.research) args.push("--allowedTools", "WebSearch", "WebFetch");
  return args;
}

const rawClaudeRun: CliRunner = (args, stdin, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    // shell:true is required on Windows (the global `claude` is a .cmd shim;
    // Node 22 refuses to spawn .cmd directly). Prompt goes via stdin, not args,
    // so there's no shell-injection surface. Works on POSIX shells too.
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"], shell: true });
    let out = "", err = "", settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`claude timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += String(d)));
    child.stderr.on("data", (d) => (err += String(d)));
    child.on("error", (e) => { if (settled) return; settled = true; clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err}`));
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });

// One retry on transient failure (timeout, non-zero exit, spawn error). Capped
// at 2 attempts so 2×120s research calls stay under Vercel's 300s ceiling.
export const claudeCliRunner: CliRunner = (args, stdin, timeoutMs) =>
  withRetry(() => rawClaudeRun(args, stdin, timeoutMs), {
    retries: 1,
    baseMs: 1000,
    onRetry: (err) => console.error("claude runner retry:", err),
  });
