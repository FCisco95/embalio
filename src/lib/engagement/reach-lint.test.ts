// src/lib/engagement/reach-lint.test.ts
import { describe, it, expect } from "vitest";
import { reachLint, type ReachLintFinding } from "./reach-lint";

const codes = (fs: ReachLintFinding[]) => fs.map((f) => f.code);

describe("reachLint — post kind", () => {
  it("clean short post → only the native-media nudge (info)", () => {
    const fs = reachLint("shipped the manual sniper mode today. zero Apify.", "post");
    expect(codes(fs)).toEqual(["native_media"]);
    expect(fs[0].severity).toBe("info");
  });

  it("warns on an external link in the first paragraph (main tweet)", () => {
    const fs = reachLint("new post is live https://blog.example.com/x\n\nmore context here", "post");
    expect(codes(fs)).toContain("link_in_main");
    expect(fs.find((f) => f.code === "link_in_main")?.severity).toBe("warn");
  });

  it("does NOT warn when the link sits in a later paragraph (that's reply-1 material)", () => {
    const fs = reachLint("hook line solo\n\ndetails…\n\nlink: https://x.com/foo/status/1", "post");
    expect(codes(fs)).not.toContain("link_in_main");
  });

  it("suggests a thread split for >280 chars", () => {
    const fs = reachLint("a".repeat(300), "post");
    expect(codes(fs)).toContain("thread_split");
  });

  it("suggests a thread split for 3+ paragraphs even under 280 chars", () => {
    const fs = reachLint("one\n\ntwo\n\nthree", "post");
    expect(codes(fs)).toContain("thread_split");
  });

  it("no thread-split warning for a tight 2-paragraph post under 280", () => {
    const fs = reachLint("hook line\n\nsecond beat", "post");
    expect(codes(fs)).not.toContain("thread_split");
  });

  it("all findings are advisory — every finding carries a message", () => {
    const fs = reachLint("x https://a.b\n\n1\n\n2\n\n3" + "y".repeat(300), "post");
    expect(fs.length).toBeGreaterThanOrEqual(3);
    for (const f of fs) expect(f.message.length).toBeGreaterThan(10);
  });
});

describe("reachLint — hook kind (thread tweet #1)", () => {
  it("clean one-liner hook → only the media nudge", () => {
    expect(codes(reachLint("the 0.66% OON stat nobody talks about:", "hook"))).toEqual(["native_media"]);
  });

  it("warns on a link in the hook", () => {
    expect(codes(reachLint("read this https://example.com", "hook"))).toContain("link_in_main");
  });

  it("warns when the hook is not a solo line (multi-paragraph or >200 chars)", () => {
    expect(codes(reachLint("line one\n\nline two", "hook"))).toContain("hook_not_solo");
    expect(codes(reachLint("h".repeat(220), "hook"))).toContain("hook_not_solo");
  });

  it("hook kind never emits thread_split (it is already a thread)", () => {
    expect(codes(reachLint("x".repeat(300), "hook"))).not.toContain("thread_split");
  });
});

describe("reachLint — body kind (thread tweets 2+)", () => {
  it("links are fine in body tweets (reply-1 rule) and no media nudge either", () => {
    expect(reachLint("details + link https://example.com", "body")).toEqual([]);
  });
});

describe("reachLint — edge cases", () => {
  it("empty/whitespace text → no findings", () => {
    expect(reachLint("", "post")).toEqual([]);
    expect(reachLint("   \n ", "hook")).toEqual([]);
  });
});
