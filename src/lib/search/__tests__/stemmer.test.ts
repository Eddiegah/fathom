import { describe, expect, it } from "vitest";
import { stem } from "../stemmer";

describe("stemmer: word families converge to the same root", () => {
  // This is the property that actually matters for search quality - a
  // query for "run" must match documents containing "running" or "runs".
  // It's a stronger, more important guarantee than matching any one
  // reference implementation's exact output spelling.
  const families: string[][] = [
    ["run", "running", "runs"],
    ["connect", "connected", "connecting", "connection", "connections"],
    ["organize", "organizes", "organizing", "organization"],
    ["national", "nationality"],
    ["relate", "related", "relates", "relating"],
    ["happy", "happiness"],
    ["generalize", "generalization", "generalizes"],
  ];

  for (const family of families) {
    it(`"${family.join('", "')}" all stem to the same root`, () => {
      const stems = family.map(stem);
      const distinct = new Set(stems);
      expect(distinct.size).toBe(1);
    });
  }

  it("never produces a stem longer than the input", () => {
    const words = ["cats", "running", "national", "generalization", "sky", "y", "at"];
    for (const word of words) {
      expect(stem(word).length).toBeLessThanOrEqual(word.length);
    }
  });
});

describe("stemmer: canonical examples from Porter's own paper", () => {
  // Porter's paper illustrates several of these mid-pipeline (e.g. "agreed"
  // shows only step 1b's effect, landing on "agree"), but a full stem()
  // call runs every step in sequence, and later steps can reduce the
  // word further - "agreed" -> "agree" (step 1b) -> "agre" (step 5a
  // strips the trailing e once more, since m=1 and the stem isn't cvc).
  // The values below are the true end-to-end output, matching reference
  // Porter stemmer implementations rather than the paper's per-step demo.
  const cases: [string, string][] = [
    ["caresses", "caress"],
    ["ponies", "poni"],
    ["ties", "ti"],
    ["caress", "caress"],
    ["cats", "cat"],
    ["feed", "feed"],
    ["agreed", "agre"],
    ["plastered", "plaster"],
    ["bled", "bled"],
    ["motoring", "motor"],
    ["sing", "sing"],
    ["happy", "happi"],
    ["sky", "sky"],
    ["relational", "relat"],
    ["conditional", "condit"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" -> "${expected}"`, () => {
      expect(stem(input)).toBe(expected);
    });
  }
});

describe("stemmer: leaves short words and stopword-like tokens alone", () => {
  it("does not touch words of length 2 or shorter", () => {
    expect(stem("is")).toBe("is");
    expect(stem("a")).toBe("a");
  });
});
