// xAI lane scan: one Responses-API call with the server-side x_search tool.
// Shape per https://docs.x.ai/developers/tools/x-search and
// https://docs.x.ai/docs/guides/structured-outputs (POST /v1/responses,
// tools:[{type:"x_search", from_date, to_date, excluded_x_handles}], text.format json_schema).
// Fault-tolerant by contract: any error logs one line and returns null.
import { z } from "zod";

export const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
export const DEFAULT_XAI_MODEL = "grok-4.7";
export const MAX_SCAN_ITEMS = 8;
const REQUEST_TIMEOUT_MS = 90_000;
const USD_PER_1K_POSTS = 5;

const ScanItemSchema = z.object({
  handle: z.string(),
  excerpt: z.string(),
  approx_engagement: z.string(),
  why_it_matters: z.string(),
});
const ScanSchema = z.object({
  items: z.array(ScanItemSchema).min(1),
  posts_returned_estimate: z.number().nonnegative(),
});

export type LaneScanItem = z.infer<typeof ScanItemSchema>;
export interface LaneScan {
  items: LaneScanItem[];
  posts_returned_estimate: number;
}

export interface LaneScanArgs {
  apiKey: string;
  model?: string;
  pillars: string[];
  handle: string;
}

/** $5 per 1k posts returned by x_search (token cost not included). */
export function estimateXaiCostUsd(postsReturned: number): number {
  return (postsReturned / 1000) * USD_PER_1K_POSTS;
}

const SCAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          handle: { type: "string" },
          excerpt: { type: "string" },
          approx_engagement: { type: "string" },
          why_it_matters: { type: "string" },
        },
        required: ["handle", "excerpt", "approx_engagement", "why_it_matters"],
        additionalProperties: false,
      },
    },
    posts_returned_estimate: { type: "integer" },
  },
  required: ["items", "posts_returned_estimate"],
  additionalProperties: false,
};

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY_MS = 86_400_000;

export function buildLaneScanRequest(
  { apiKey, model, pillars, handle }: LaneScanArgs,
  now: Date = new Date(),
): { url: string; init: RequestInit } {
  const prompt = [
    `Search X for the 5-8 most engaging posts of the last 24 hours in this lane: ${pillars.join(", ")}.`,
    `Prefer posts with real engagement from builders, not engagement bait. Skip anything older than 24 hours.`,
    `For each post give: the author handle, a short excerpt (max 200 characters), approximate engagement (likes/replies as plain text), and one sentence on why it matters for an account in this lane.`,
    `Set posts_returned_estimate to the total number of posts you looked at. Return only the JSON.`,
  ].join("\n");
  const body = {
    model: model || DEFAULT_XAI_MODEL,
    input: [{ role: "user", content: prompt }],
    tools: [
      {
        type: "x_search",
        from_date: isoDay(now.getTime() - DAY_MS),
        to_date: isoDay(now.getTime() + DAY_MS), // exclusive end: includes today (UTC)
        excluded_x_handles: [handle.replace(/^@/, "")],
      },
    ],
    text: {
      format: { type: "json_schema", name: "lane_scan", schema: SCAN_JSON_SCHEMA, strict: true },
    },
  };
  return {
    url: XAI_RESPONSES_URL,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    },
  };
}

function assistantText(json: Record<string, unknown>): string | null {
  if (typeof json.output_text === "string") return json.output_text;
  if (!Array.isArray(json.output)) return null;
  let text: string | null = null;
  for (const o of json.output as Array<Record<string, unknown>>) {
    if (o?.type !== "message" || !Array.isArray(o.content)) continue;
    for (const c of o.content as Array<Record<string, unknown>>) {
      if (c?.type === "output_text" && typeof c.text === "string") text = c.text;
    }
  }
  return text;
}

function billedPosts(json: Record<string, unknown>): number | null {
  const usage = json.usage as { server_side_tool_usage_details?: { x_posts_fetched?: unknown } } | undefined;
  const n = usage?.server_side_tool_usage_details?.x_posts_fetched;
  return typeof n === "number" && n >= 0 ? n : null;
}

export function parseLaneScanResponse(json: unknown): LaneScan | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  const text = assistantText(record);
  if (!text) return null;
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  const r = ScanSchema.safeParse(parsed);
  if (!r.success) return null;
  return {
    items: r.data.items
      .slice(0, MAX_SCAN_ITEMS)
      .map((i) => ({ ...i, handle: `@${i.handle.replace(/^@/, "")}` })),
    posts_returned_estimate: billedPosts(record) ?? r.data.posts_returned_estimate,
  };
}

export async function laneScan(
  args: LaneScanArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<LaneScan | null> {
  try {
    const { url, init } = buildLaneScanRequest(args);
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`[xsearch] lane scan skipped: HTTP ${res.status}`);
      return null;
    }
    const scan = parseLaneScanResponse(await res.json());
    if (!scan) console.warn("[xsearch] lane scan skipped: unparseable response");
    return scan;
  } catch (e) {
    console.warn(`[xsearch] lane scan skipped: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
