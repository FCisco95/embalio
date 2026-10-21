import { describe, expect, it } from "vitest";
import { bodyHasUrl, extractTrailingLink } from "@/lib/posting/link-rule";

describe("bodyHasUrl", () => {
  it("detects http(s) and www urls anywhere", () => {
    expect(bodyHasUrl("read https://example.com/a?b=1 now")).toBe(true);
    expect(bodyHasUrl("http://example.com")).toBe(true);
    expect(bodyHasUrl("see www.example.com for more")).toBe(true);
  });
  it("is false for plain text", () => {
    expect(bodyHasUrl("no links here, just words.")).toBe(false);
    expect(bodyHasUrl("")).toBe(false);
  });
});

describe("extractTrailingLink", () => {
  it("moves a trailing url into link_url and trims the text", () => {
    expect(extractTrailingLink("Big idea on retention\n\nhttps://example.com/post")).toEqual({
      text: "Big idea on retention",
      link_url: "https://example.com/post",
    });
  });

  it("ignores surrounding whitespace", () => {
    expect(extractTrailingLink("  hello https://a.co/x  \n")).toEqual({ text: "hello", link_url: "https://a.co/x" });
  });

  it("drops sentence punctuation that trails the url", () => {
    expect(extractTrailingLink("worth a read https://a.co/x.")).toEqual({ text: "worth a read", link_url: "https://a.co/x" });
  });

  it("returns the body unchanged when there is no url", () => {
    expect(extractTrailingLink("just words")).toEqual({ text: "just words", link_url: null });
  });

  it("leaves a url in the middle alone (action refuses it via bodyHasUrl)", () => {
    const body = "first https://a.co/x then more words";
    expect(extractTrailingLink(body)).toEqual({ text: body, link_url: null });
    expect(bodyHasUrl(body)).toBe(true);
  });

  it("does not extract when another url remains in the body", () => {
    const body = "see https://a.co/1 and https://b.co/2";
    const out = extractTrailingLink(body);
    expect(out.link_url).toBeNull();
    expect(out.text).toBe(body);
  });

  it("a text-only result still passes bodyHasUrl === false after extraction", () => {
    const { text } = extractTrailingLink("thoughts https://a.co/x");
    expect(bodyHasUrl(text)).toBe(false);
  });
});
