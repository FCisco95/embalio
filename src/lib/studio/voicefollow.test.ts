import { describe, it, expect } from "vitest";
import { flattenScript, createFollower } from "./voicefollow";

const beats = [
  { id: "b1", say: "open the cookbook and run the scan", visualPrompt: "v" },
  { id: "b2", say: "except I have an RTX 3080 right here", visualPrompt: "v" },
];

describe("flattenScript", () => {
  it("emits one token per word tagged with its beat index", () => {
    const toks = flattenScript(beats);
    expect(toks[0]).toEqual({ word: "open", beatIndex: 0, globalIndex: 0 });
    expect(toks.at(-1)).toEqual({ word: "here", beatIndex: 1, globalIndex: toks.length - 1 });
    const firstB2 = toks.find((t) => t.beatIndex === 1);
    expect(firstB2?.word).toBe("except");
  });
});

describe("createFollower", () => {
  it("advances position as matching words arrive", () => {
    const f = createFollower(flattenScript(beats));
    let state = f.push(["open", "the", "cookbook"]);
    expect(state.tokenIndex).toBe(3);   // matched 3 words
    expect(state.beatIndex).toBe(0);
  });

  it("crosses into the next beat", () => {
    const f = createFollower(flattenScript(beats));
    f.push(["open", "the", "cookbook", "and", "run", "the", "scan"]);
    const state = f.push(["except", "I", "have"]);
    expect(state.beatIndex).toBe(1);
  });

  it("never moves backward on a repeated/echoed word", () => {
    const f = createFollower(flattenScript(beats));
    const a = f.push(["open", "the", "cookbook"]);
    const b = f.push(["open"]);            // echo of an earlier word
    expect(b.tokenIndex).toBeGreaterThanOrEqual(a.tokenIndex);
  });

  it("holds position when an off-script word arrives (ad-lib)", () => {
    const f = createFollower(flattenScript(beats));
    const a = f.push(["open", "the"]);
    const b = f.push(["honestly", "umm"]); // not in the look-ahead window
    expect(b.tokenIndex).toBe(a.tokenIndex);
  });

  it("tolerates a near-miss within the fuzzy threshold", () => {
    const f = createFollower(flattenScript(beats));
    const state = f.push(["open", "the", "cookbok"]); // typo/mis-hear of "cookbook"
    expect(state.tokenIndex).toBe(3);
  });
});
