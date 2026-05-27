import type { ZodType } from "zod";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const objStart = body.indexOf("{");
  const arrStart = body.indexOf("[");
  const start = [objStart, arrStart].filter((n) => n >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) return null;
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  if (end <= start) return null;
  return body.slice(start, end + 1);
}

export function parseStructured<T>(schema: ZodType<T>, text: string): ParseResult<T> {
  const json = extractJson(text);
  if (!json) return { ok: false, error: "no JSON found" };
  let value: unknown;
  try { value = JSON.parse(json); } catch (e) { return { ok: false, error: `invalid JSON: ${String(e)}` }; }
  const r = schema.safeParse(value);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.message };
}
