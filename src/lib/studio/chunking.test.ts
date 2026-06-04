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
  it("does not corrupt standalone digits in the text", () => {
    expect(toLines("I scored 0 points. Then I won.", "sent"))
      .toEqual(["I scored 0 points.", "Then I won."]);
  });
  it("handles an abbreviation at end of text", () => {
    expect(toLines("Ship it now, etc.", "sent")).toEqual(["Ship it now, etc."]);
  });
  it("splits before a smart-quoted sentence", () => {
    expect(toLines("He said hi. “Hello” back.", "sent"))
      .toEqual(["He said hi.", "“Hello” back."]);
  });
});
