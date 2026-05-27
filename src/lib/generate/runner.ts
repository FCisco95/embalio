import { spawn } from "node:child_process";

export interface RunnerOpts { research?: boolean }
export type CliRunner = (args: string[], stdin: string) => Promise<string>;

export function buildClaudeArgs(opts: RunnerOpts): string[] {
  const args = ["-p"];
  if (opts.research) args.push("--allowedTools", "WebSearch", "WebFetch");
  return args;
}

export const claudeCliRunner: CliRunner = (args, stdin) =>
  new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += String(d)));
    child.stderr.on("data", (d) => (err += String(d)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err}`))));
    child.stdin.write(stdin);
    child.stdin.end();
  });
