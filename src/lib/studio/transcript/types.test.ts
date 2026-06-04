import { describe, it, expect } from "vitest";
import { normalizeWords } from "./types";

describe("normalizeWords", () => {
  it("splits a transcript chunk into lowercase words", () => {
    expect(normalizeWords("Open the Cookbook!")).toEqual(["open", "the", "cookbook"]);
  });
  it("drops empty fragments", () => {
    expect(normalizeWords("   ...  hi ")).toEqual(["hi"]);
  });
});
