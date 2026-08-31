import { describe, expect, it } from "vitest";
import { editDistance, findClosestTerms } from "../fuzzy";

describe("editDistance: known cases", () => {
  it("is 0 for identical strings", () => {
    expect(editDistance("kitten", "kitten")).toBe(0);
  });

  it("is the length of the other string when one is empty", () => {
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "")).toBe(3);
  });

  it("matches the classic kitten/sitting example (distance 3)", () => {
    // substitute k->s, substitute e->i, insert g - the textbook example
    expect(editDistance("kitten", "sitting")).toBe(3);
  });

  it("is 1 for a single substitution, insertion, or deletion", () => {
    expect(editDistance("cat", "bat")).toBe(1); // substitution
    expect(editDistance("cat", "cats")).toBe(1); // insertion
    expect(editDistance("cats", "cat")).toBe(1); // deletion
  });

  it("is symmetric", () => {
    expect(editDistance("flaw", "lawn")).toBe(editDistance("lawn", "flaw"));
  });

  it("satisfies the triangle inequality on a real example", () => {
    const ab = editDistance("kitten", "sitting");
    const bc = editDistance("sitting", "sitten");
    const ac = editDistance("kitten", "sitten");
    expect(ac).toBeLessThanOrEqual(ab + bc);
  });
});

describe("findClosestTerms: typo correction against a real vocabulary", () => {
  const vocabulary = ["search", "engine", "index", "query", "rank", "document", "fathom"];

  it("finds the correct word for a one-letter typo", () => {
    expect(findClosestTerms("serch", vocabulary)).toContain("search");
    expect(findClosestTerms("enigne", vocabulary)).toContain("engine");
  });

  it("returns nothing for a term wildly unlike anything in the vocabulary", () => {
    expect(findClosestTerms("xyzxyzxyz", vocabulary, 2)).toEqual([]);
  });

  it("orders results by increasing distance", () => {
    const results = findClosestTerms("indx", ["index", "indexes", "indeed", "banana"], 3);
    // "index" (distance 1) must come before any farther match
    expect(results[0]).toBe("index");
  });
});
