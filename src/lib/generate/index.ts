import { buildClaudeArgs, claudeCliRunner, type CliRunner } from "./runner";
import { generateTextGemini } from "./gemini";

export type Backend = "subscription" | "gemini";
export interface GenerateOpts { research?: boolean; backend?: Backend }

function backend(opts: GenerateOpts): Backend {
  return opts.backend ?? (process.env.GEN_BACKEND as Backend) ?? "subscription";
}

export async function generateText(
  prompt: string,
  opts: GenerateOpts = {},
  runner: CliRunner = claudeCliRunner,
): Promise<string> {
  if (backend(opts) === "gemini") return (await generateTextGemini(prompt)).trim();
  const out = await runner(buildClaudeArgs(opts), prompt);
  return out.trim();
}
