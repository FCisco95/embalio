import { describe, it, expect } from "vitest";
import { parseAnalyticsCsv, splitCsvLine, normalizeCsvDate, CsvHeaderError } from "./csv";

const HEADER =
  '"Date","Impressions","Likes","Engagements","Bookmarks","Shares","New follows","Unfollows","Replies","Reposts","Profile visits","Create Post","Video views","Media views"';
const row = (date: string, visits = "150", follows = "5") =>
  `"${date}","1,200","40","80","3","1","${follows}","1","6","2","${visits}","1","0","0"`;

describe("splitCsvLine", () => {
  it("splits plain and quoted cells, commas inside quotes preserved", () => {
    expect(splitCsvLine('"Sat, Jun 6, 2026",42,"1,200"')).toEqual(["Sat, Jun 6, 2026", "42", "1,200"]);
  });
  it("unescapes doubled quotes", () => {
    expect(splitCsvLine('"say ""hi""",2')).toEqual(['say "hi"', "2"]);
  });
  it("returns null on unbalanced quotes", () => {
    expect(splitCsvLine('"broken,2')).toBeNull();
  });
});

describe("normalizeCsvDate", () => {
  it("passes through ISO dates", () => {
    expect(normalizeCsvDate("2026-06-07")).toBe("2026-06-07");
  });
  it("normalizes X's long form via local date fields (no TZ day-shift)", () => {
    expect(normalizeCsvDate("Sat, Jun 6, 2026")).toBe("2026-06-06");
  });
  it("returns null for garbage", () => {
    expect(normalizeCsvDate("not a date")).toBeNull();
  });
});

describe("parseAnalyticsCsv", () => {
  it("parses a realistic export end to end", () => {
    const { rows, rejected } = parseAnalyticsCsv([HEADER, row("Sat, Jun 6, 2026"), row("Sun, Jun 7, 2026", "98", "3")].join("\r\n"));
    expect(rejected).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2026-06-06", profile_visits: 150, new_follows: 5, impressions: 1200 });
    expect(rows[1]).toMatchObject({ date: "2026-06-07", profile_visits: 98, new_follows: 3 });
  });

  it("is header-tolerant: case, BOM, spacing, reordering, alias 'Follows'", () => {
    const text = "﻿date,  PROFILE VISITS ,Follows\n2026-06-07,10,2";
    const { rows } = parseAnalyticsCsv(text);
    expect(rows[0]).toMatchObject({ date: "2026-06-07", profile_visits: 10, new_follows: 2 });
  });

  it("throws CsvHeaderError naming the missing required column", () => {
    expect(() => parseAnalyticsCsv("Date,Impressions\n2026-06-07,5")).toThrow(CsvHeaderError);
    expect(() => parseAnalyticsCsv("Date,Impressions\n2026-06-07,5")).toThrow(/profile_visits[\s\S]*new_follows|new_follows[\s\S]*profile_visits/);
  });

  it("throws CsvHeaderError on an empty file", () => {
    expect(() => parseAnalyticsCsv("\n\n")).toThrow(CsvHeaderError);
  });

  it("rejects a bad-date row loudly with its 1-based line number, keeps the rest", () => {
    const { rows, rejected } = parseAnalyticsCsv([HEADER, row("garbage"), row("Sun, Jun 7, 2026")].join("\n"));
    expect(rows).toHaveLength(1);
    expect(rejected).toEqual([{ line: 2, reason: expect.stringContaining("unparseable date"), raw: expect.any(String) }]);
  });

  it("rejects duplicate dates within one file", () => {
    const { rows, rejected } = parseAnalyticsCsv([HEADER, row("Sat, Jun 6, 2026"), row("Sat, Jun 6, 2026")].join("\n"));
    expect(rows).toHaveLength(1);
    expect(rejected[0].reason).toContain("duplicate date");
  });

  it("rejects a row whose required cell is empty (never coerces to 0)", () => {
    const { rows, rejected } = parseAnalyticsCsv(["Date,Profile visits,New follows", "2026-06-07,,3"].join("\n"));
    expect(rows).toHaveLength(0);
    expect(rejected[0].reason).toContain("profile_visits");
  });

  it("skips blank lines without rejecting them", () => {
    const { rows, rejected } = parseAnalyticsCsv(["Date,Profile visits,New follows", "", "2026-06-07,10,1", ""].join("\n"));
    expect(rows).toHaveLength(1);
    expect(rejected).toEqual([]);
  });
});
