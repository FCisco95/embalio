import { buildClaudeArgs, claudeCliRunner, type CliRunner } from "./runner";
import { generateTextGemini } from "./gemini";
import type { ZodType } from "zod";
import { parseStructured } from "./parse";

export type Backend = "subscription" | "gemini";
export interface GenerateOpts {
  research?: boolean;
  backend?: Backend;
  /**
   * Total tries (initial + retries) the model gets to satisfy the schema.
   * Defaults to 2 (one corrective retry). Bump it for constraint-heavy schemas
   * — e.g. a multi-tweet thread, where any single tweet can blow a length limit
   * and one retry can't reliably fix every item at once.
   */
  attempts?: number;
}

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
  const attempts = Math.max(1, opts.attempts ?? 2);
  let raw = "";
  let lastError = "";
  for (let i = 0; i < attempts; i++) {
    // After a miss, feed the actual validation error back so the model fixes the
    // specific problem (e.g. a string over its max length) instead of repeating
    // it — a plain "not valid JSON" nudge can't fix a schema-constraint violation.
    const input =
      i === 0
        ? ask
        : `${ask}\n\nYour previous reply did not satisfy the required shape.\nError: ${lastError}\nReturn ONLY a corrected JSON object that satisfies every constraint (including any string length limits).`;
    raw = await generateText(input, opts, runner);
    const parsed = parseStructured(schema, raw);
    if (parsed.ok) return { data: parsed.data };
    lastError = parsed.error;
  }
  return { data: null, raw };
}
