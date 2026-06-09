export interface ParsedCallback { action: "posted" | "skip"; candidateId: string }

/** Parse the inline-button payloads runPulse already emits: `posted:<id>` / `skip:<id>`. */
export function parseCallback(data: string): ParsedCallback | null {
  const m = /^(posted|skip):(.+)$/.exec(data);
  if (!m) return null;
  return { action: m[1] as "posted" | "skip", candidateId: m[2] };
}
