import { buildClaudeArgs, claudeCliRunner, type CliRunner } from "./runner";
import { generateTextGemini } from "./gemini";
import type { ZodType } from "zod";
import { parseStructured } from "./parse";

export type Backend = "subscription" | "gemini";
export interface GenerateOpts { research?: boolean; backend?: Backend }

function backend(opts: GenerateOpts): Backend {
  if (opts.backend) return opts.backend;
  const env = process.env.GEN_BACKEND;
  if (!env) return "subscription";
  if (env !== "subscription" && env !== "gemini") throw new Error(`Unknown GEN_BACKEND: "${env}"`);
  return env;
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

export type StructuredResult<T> = { data: T } | { data: null; raw: string };

export async function generateStructured<T>(
  schema: ZodType<T>,
  prompt: string,
  opts: GenerateOpts = {},
  runner: CliRunner = claudeCliRunner,
): Promise<StructuredResult<T>> {
  const ask = `${prompt}\n\nRespond with ONLY valid JSON matching the requested shape. No prose, no markdown fences.`;
  let raw = await generateText(ask, opts, runner);
  let parsed = parseStructured(schema, raw);
  if (!parsed.ok) {
    raw = await generateText(`${ask}\n\nYour previous reply was not valid JSON. Return ONLY the JSON object.`, opts, runner);
    parsed = parseStructured(schema, raw);
  }
  return parsed.ok ? { data: parsed.data } : { data: null, raw };
}
