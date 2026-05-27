import type { ZodType } from "zod";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Yields candidate JSON substrings from messy model output: fenced ```json blocks
// first, then every brace/bracket-balanced region, largest first. Real payloads are
// the biggest balanced region, so stray braces in prose ("{280}") never win.
function* jsonCandidates(text: string): Generator<string> {
  const fenced: string[] = [];
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text))) fenced.push(m[1]);

  const regions: string[] = [];
  for (const src of [...fenced, text]) {
    for (let i = 0; i < src.length; i++) {
      const open = src[i];
      if (open !== "{" && open !== "[") continue;
      const close = open === "{" ? "}" : "]";
      let depth = 0;
      for (let j = i; j < src.length; j++) {
        if (src[j] === open) depth++;
        else if (src[j] === close && --depth === 0) { regions.push(src.slice(i, j + 1)); break; }
      }
    }
  }
  regions.sort((a, b) => b.length - a.length);
  yield* regions;
}

export function parseStructured<T>(schema: ZodType<T>, text: string): ParseResult<T> {
  let lastErr = "no JSON found";
  for (const candidate of jsonCandidates(text)) {
    let value: unknown;
    try { value = JSON.parse(candidate); } catch { lastErr = "invalid JSON"; continue; }
    const r = schema.safeParse(value);
    if (r.success) return { ok: true, data: r.data };
    lastErr = r.error.message;
  }
  return { ok: false, error: lastErr };
}
