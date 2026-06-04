import { describe, it, expect } from "vitest";
import { toLines } from "./chunking";

describe("toLines", () => {
  it("paragraph mode returns the whole say as one line", () => {
    expect(toLines("Hello there. How are you?", "para")).toEqual(["Hello there. How are you?"]);
  });
  it("sentence mode splits on . ! ? keeping terminators", () => {
    expect(toLines("Hello there. How are you? Great!", "sent"))
      .toEqual(["Hello there.", "How are you?", "Great!"]);
  });
  it("does not split common abbreviations", () => {
    expect(toLines("I use e.g. Claude here. Then I ship.", "sent"))
      .toEqual(["I use e.g. Claude here.", "Then I ship."]);
  });
  it("trims whitespace and drops empty fragments", () => {
    expect(toLines("  One.   Two.  ", "sent")).toEqual(["One.", "Two."]);
  });
  it("returns a single line when there is no terminal punctuation", () => {
    expect(toLines("no punctuation here", "sent")).toEqual(["no punctuation here"]);
  });
});
