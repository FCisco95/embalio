import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_XAI_MODEL,
  XAI_RESPONSES_URL,
  buildLaneScanRequest,
  estimateXaiCostUsd,
  laneScan,
  parseLaneScanResponse,
} from "./xsearch";

const NOW = new Date("2026-10-21T10:00:00Z");

const scanPayload = {
  items: [
    { handle: "@a", excerpt: "agents ship faster than evals", approx_engagement: "1.2k likes", why_it_matters: "shows eval gap" },
    { handle: "b", excerpt: "claude code hooks tip", approx_engagement: "400 likes", why_it_matters: "practical" },
  ],
  posts_returned_estimate: 14,
};

const xaiResponse = (payload: unknown, usage?: unknown) => ({
  id: "resp_1",
  output: [
    { type: "custom_tool_call", name: "x_keyword_search" },
    { type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(payload) }] },
  ],
  usage,
});

describe("buildLaneScanRequest", () => {
  const req = buildLaneScanRequest({ apiKey: "k", model: "grok-x", pillars: ["ai agents", "claude code"], handle: "@me" }, NOW);

  it("targets the Responses endpoint with bearer auth", () => {
    expect(req.url).toBe(XAI_RESPONSES_URL);
    expect(XAI_RESPONSES_URL).toBe("https://api.x.ai/v1/responses");
    expect(req.init.method).toBe("POST");
    const headers = req.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer k");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("enables x_search over the last-24h date window and a json_schema output", () => {
    const body = JSON.parse(req.init.body as string);
    expect(body.model).toBe("grok-x");
    expect(body.tools).toEqual([
      { type: "x_search", from_date: "2026-10-20", to_date: "2026-10-22", excluded_x_handles: ["me"] },
    ]);
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.required).toEqual(["items", "posts_returned_estimate"]);
  });

  it("puts the pillars and the 5-8 posts ask in the user input", () => {
    const body = JSON.parse(req.init.body as string);
    const text = JSON.stringify(body.input);
    expect(body.input[0].role).toBe("user");
    expect(text).toContain("ai agents");
    expect(text).toContain("claude code");
    expect(text).toMatch(/5.{0,5}8/);
  });

  it("falls back to the default model when none is given", () => {
    const r = buildLaneScanRequest({ apiKey: "k", pillars: ["x"], handle: "me" }, NOW);
    expect(JSON.parse(r.init.body as string).model).toBe(DEFAULT_XAI_MODEL);
    expect(DEFAULT_XAI_MODEL).toBe("grok-4.7");
  });
});

describe("parseLaneScanResponse", () => {
  it("reads the assistant message output_text and normalises handles", () => {
    const r = parseLaneScanResponse(xaiResponse(scanPayload));
    expect(r?.items.map((i) => i.handle)).toEqual(["@a", "@b"]);
    expect(r?.posts_returned_estimate).toBe(14);
  });

  it("prefers the billed x_posts_fetched usage over the model's own estimate", () => {
    const r = parseLaneScanResponse(xaiResponse(scanPayload, { server_side_tool_usage_details: { x_posts_fetched: 19 } }));
    expect(r?.posts_returned_estimate).toBe(19);
  });

  it("accepts a top-level output_text string and fenced JSON", () => {
    const r = parseLaneScanResponse({ output_text: "```json\n" + JSON.stringify(scanPayload) + "\n```" });
    expect(r?.items).toHaveLength(2);
  });

  it("caps items at 8", () => {
    const many = { items: Array.from({ length: 12 }, (_, i) => ({ handle: `u${i}`, excerpt: "e", approx_engagement: "1", why_it_matters: "w" })), posts_returned_estimate: 12 };
    expect(parseLaneScanResponse(xaiResponse(many))?.items).toHaveLength(8);
  });

  it.each([
    ["null", null],
    ["no output", {}],
    ["no message item", { output: [{ type: "custom_tool_call" }] }],
    ["non-JSON text", { output_text: "sorry, nothing" }],
    ["wrong shape", xaiResponse({ items: "nope" })],
    ["empty items", xaiResponse({ items: [], posts_returned_estimate: 0 })],
  ])("returns null for %s", (_n, input) => {
    expect(parseLaneScanResponse(input)).toBeNull();
  });
});

describe("estimateXaiCostUsd", () => {
  it("is $5 per 1k posts", () => {
    expect(estimateXaiCostUsd(0)).toBe(0);
    expect(estimateXaiCostUsd(1000)).toBe(5);
    expect(estimateXaiCostUsd(14)).toBeCloseTo(0.07);
  });
});

describe("laneScan", () => {
  const args = { apiKey: "k", model: "grok-x", pillars: ["ai"], handle: "me" };

  it("returns the parsed scan on success, calling fetch once", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(xaiResponse(scanPayload)), { status: 200 }));
    const r = await laneScan(args, f as unknown as typeof fetch);
    expect(r?.items).toHaveLength(2);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns null on HTTP error and logs one line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn(async () => new Response("nope", { status: 401 }));
    expect(await laneScan(args, f as unknown as typeof fetch)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("returns null when fetch throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await laneScan(args, f as unknown as typeof fetch)).toBeNull();
    warn.mockRestore();
  });

  it("returns null on an unparseable body", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn(async () => new Response("not json", { status: 200 }));
    expect(await laneScan(args, f as unknown as typeof fetch)).toBeNull();
    warn.mockRestore();
  });
});
