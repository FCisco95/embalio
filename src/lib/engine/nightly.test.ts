import { describe, expect, it } from "vitest";
import {
  NightlyDraftsSchema,
  buildDraftInsert,
  clampMax,
  computeScheduledAt,
  containsUrl,
  isEligibleProfile,
  isNearDuplicate,
  jaccard,
  sanitizeLinkUrl,
  parseNightlyArgs,
  validateDraftItems,
  type NightlyDraftItem,
} from "./nightly";

const item = (over: Partial<NightlyDraftItem> = {}): NightlyDraftItem => ({
  body: "shipped a cron that writes tomorrow's queue while I sleep",
  angle: "build in public",
  rationale: "concrete, first-person, invites replies",
  link_url: null,
  suggested_hour_lisbon: 9,
  ...over,
});

describe("jaccard / isNearDuplicate", () => {
  it("is 1 for identical word sets regardless of case and punctuation", () => {
    expect(jaccard("Hello, World!", "hello world")).toBe(1);
  });
  it("is 0 for disjoint text and for two empty strings", () => {
    expect(jaccard("alpha beta", "gamma delta")).toBe(0);
    expect(jaccard("", "")).toBe(0);
  });
  it("rejects at the 0.6 boundary and accepts below it", () => {
    // 3 shared of 5 unique words = 0.6
    expect(jaccard("a b c d", "a b c e")).toBeCloseTo(0.6);
    expect(isNearDuplicate("a b c d", ["a b c e"])).toBe(true);
    // 2 shared of 6 unique words = 0.33
    expect(isNearDuplicate("a b c d", ["a b x y"])).toBe(false);
  });
  it("matches against any entry in the list", () => {
    expect(isNearDuplicate("one two three", ["zzz", "one two three!"])).toBe(true);
    expect(isNearDuplicate("one two three", [])).toBe(false);
  });
});

describe("containsUrl", () => {
  it.each(["see https://x.com/a", "http://foo.bar", "go to WWW.example.com", "HTTPS://A.B"])(
    "flags %s",
    (s) => expect(containsUrl(s)).toBe(true),
  );
  it("passes plain text, including bare domains without a scheme or www", () => {
    expect(containsUrl("shipped it today")).toBe(false);
  });
});

describe("NightlyDraftsSchema", () => {
  it("accepts 1-3 well-formed items", () => {
    expect(NightlyDraftsSchema.safeParse([item()]).success).toBe(true);
    expect(NightlyDraftsSchema.safeParse([item(), item(), item()]).success).toBe(true);
  });
  it("rejects empty, >3, non-integer or out-of-range hours", () => {
    expect(NightlyDraftsSchema.safeParse([]).success).toBe(false);
    expect(NightlyDraftsSchema.safeParse([item(), item(), item(), item()]).success).toBe(false);
    expect(NightlyDraftsSchema.safeParse([item({ suggested_hour_lisbon: 5 })]).success).toBe(false);
    expect(NightlyDraftsSchema.safeParse([item({ suggested_hour_lisbon: 23 })]).success).toBe(false);
    expect(NightlyDraftsSchema.safeParse([item({ suggested_hour_lisbon: 9.5 })]).success).toBe(false);
  });
  it("allows link_url null or string", () => {
    expect(NightlyDraftsSchema.safeParse([item({ link_url: "https://example.com/x" })]).success).toBe(true);
  });
});

describe("validateDraftItems", () => {
  const base = { premium: false, doNotRephrase: [] as string[] };

  it("keeps a clean item", () => {
    const r = validateDraftItems([item()], base);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });
  it("rejects bodies over 280 chars unless premium", () => {
    const long = item({ body: "x".repeat(281) });
    expect(validateDraftItems([long], base).rejected[0].reason).toMatch(/length/i);
    expect(validateDraftItems([long], { ...base, premium: true }).accepted).toHaveLength(1);
    expect(validateDraftItems([item({ body: "x".repeat(4001) })], { ...base, premium: true }).rejected).toHaveLength(1);
  });
  it("accepts exactly 280 chars", () => {
    expect(validateDraftItems([item({ body: "y".repeat(280) })], base).accepted).toHaveLength(1);
  });
  it("rejects a URL in the body", () => {
    const r = validateDraftItems([item({ body: "read this https://a.com now" })], base);
    expect(r.rejected[0].reason).toMatch(/url/i);
  });
  it("rejects blank angle or rationale", () => {
    expect(validateDraftItems([item({ angle: "  " })], base).rejected).toHaveLength(1);
    expect(validateDraftItems([item({ rationale: "" })], base).rejected).toHaveLength(1);
  });
  it("rejects a near-duplicate of do-not-rephrase text", () => {
    const old = "Shipped a cron that writes tomorrow's queue while I sleep!";
    const r = validateDraftItems([item()], { ...base, doNotRephrase: [old] });
    expect(r.rejected[0].reason).toMatch(/duplicate/i);
  });
  it("rejects a near-duplicate of an earlier accepted item in the same batch", () => {
    const r = validateDraftItems([item(), item()], base);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(1);
  });
  it("keeps good items when others are rejected", () => {
    const r = validateDraftItems(
      [item({ body: "see https://a.com" }), item({ body: "a completely different observation about retry budgets" })],
      base,
    );
    expect(r.accepted.map((i) => i.body)).toEqual(["a completely different observation about retry budgets"]);
  });
});

describe("computeScheduledAt (Europe/Lisbon)", () => {
  it("summer time (UTC+1): later today", () => {
    // 2026-10-21T10:00Z = 11:00 Lisbon; 18:00 Lisbon = 17:00Z
    expect(computeScheduledAt(18, new Date("2026-10-21T10:00:00Z"))).toBe("2026-10-21T17:00:00.000Z");
  });
  it("winter time (UTC+0): later today", () => {
    expect(computeScheduledAt(18, new Date("2026-12-10T10:00:00Z"))).toBe("2026-12-10T18:00:00.000Z");
  });
  it("rolls to tomorrow when the hour already passed", () => {
    // 11:00 Lisbon now, 9:00 passed -> tomorrow 09:00 Lisbon = 08:00Z
    expect(computeScheduledAt(9, new Date("2026-10-21T10:00:00Z"))).toBe("2026-10-22T08:00:00.000Z");
  });
  it("rolls to tomorrow when the hour is exactly now", () => {
    expect(computeScheduledAt(11, new Date("2026-10-21T10:00:00Z"))).toBe("2026-10-22T10:00:00.000Z");
  });
  it("uses the Lisbon calendar date, not the UTC one", () => {
    // 23:30Z on 10-21 is 00:30 on 10-22 in Lisbon (UTC+1)
    expect(computeScheduledAt(9, new Date("2026-10-21T23:30:00Z"))).toBe("2026-10-22T08:00:00.000Z");
  });
  it("handles the DST fall-back boundary (clocks change 2026-10-25)", () => {
    // 21:00 Lisbon on 10-24; tomorrow 09:00 is already UTC+0
    expect(computeScheduledAt(9, new Date("2026-10-24T20:00:00Z"))).toBe("2026-10-25T09:00:00.000Z");
  });
  it("handles the DST spring-forward boundary (clocks change 2027-03-28)", () => {
    // 2027-03-27 20:00Z = 20:00 Lisbon (UTC+0); tomorrow 09:00 is UTC+1 -> 08:00Z
    expect(computeScheduledAt(9, new Date("2027-03-27T20:00:00Z"))).toBe("2027-03-28T08:00:00.000Z");
  });
});

describe("buildDraftInsert", () => {
  it("builds the exact insert row", () => {
    const now = new Date("2026-10-21T10:00:00Z");
    const row = buildDraftInsert(item({ link_url: "https://example.com/p", suggested_hour_lisbon: 18 }), { id: "p1" }, now);
    expect(row).toEqual({
      profile_id: "p1",
      kind: "original",
      status: "draft",
      body: "shipped a cron that writes tomorrow's queue while I sleep",
      angle: "build in public",
      rationale: "concrete, first-person, invites replies",
      link_url: "https://example.com/p",
      scheduled_at: "2026-10-21T17:00:00.000Z",
      model_used: "claude-subscription",
    });
  });
  it("trims text and keeps null link_url", () => {
    const row = buildDraftInsert(item({ body: "  hi there  ", angle: " a ", rationale: " r " }), { id: "p1" }, new Date("2026-10-21T10:00:00Z"));
    expect(row.body).toBe("hi there");
    expect(row.angle).toBe("a");
    expect(row.rationale).toBe("r");
    expect(row.link_url).toBeNull();
  });
});

describe("sanitizeLinkUrl / link_url on insert", () => {
  it.each([
    ["https://example.com/p", "https://example.com/p"],
    ["http://example.com", "http://example.com"],
    ["  https://example.com/p?a=1  ", "https://example.com/p?a=1"],
  ])("keeps a real http(s) URL: %s", (input, out) => {
    expect(sanitizeLinkUrl(input)).toBe(out);
  });

  it.each([[""], ["   "], ["[link]"], ["{link}"], ["TBD"], ["example.com/p"], ["ftp://x.com/a"], ["https://"], ["https://a.com/ b"], ["see https://a.com"], [null], [undefined]])(
    "nullifies %j",
    (input) => {
      expect(sanitizeLinkUrl(input as string | null)).toBeNull();
    },
  );

  it("buildDraftInsert never writes a placeholder into link_url", () => {
    const now = new Date("2026-10-21T10:00:00Z");
    for (const bad of ["", "[link]", "n/a"]) {
      expect(buildDraftInsert(item({ link_url: bad }), { id: "p1" }, now).link_url).toBeNull();
    }
    expect(buildDraftInsert(item({ link_url: " https://example.com/p " }), { id: "p1" }, now).link_url).toBe("https://example.com/p");
  });
});

describe("isEligibleProfile", () => {
  it("needs a voice spec or pillars", () => {
    expect(isEligibleProfile({ voice_spec: "x", content_pillars: [] })).toBe(true);
    expect(isEligibleProfile({ voice_spec: null, content_pillars: ["ai"] })).toBe(true);
    expect(isEligibleProfile({ voice_spec: null, content_pillars: [] })).toBe(false);
    expect(isEligibleProfile({ voice_spec: "  ", content_pillars: [] })).toBe(false);
  });
});

describe("clampMax / parseNightlyArgs", () => {
  it("clamps to 1-3 and defaults to 3", () => {
    expect(clampMax(undefined)).toBe(3);
    expect(clampMax(0)).toBe(1);
    expect(clampMax(2)).toBe(2);
    expect(clampMax(9)).toBe(3);
    expect(clampMax(Number.NaN)).toBe(3);
  });
  it("parses flags", () => {
    expect(parseNightlyArgs([])).toEqual({ profile: undefined, dryRun: false, max: 3 });
    expect(parseNightlyArgs(["--profile", "abc", "--dry-run", "--max", "2"])).toEqual({
      profile: "abc",
      dryRun: true,
      max: 2,
    });
    expect(parseNightlyArgs(["--max", "50"]).max).toBe(3);
  });
});
