import { describe, expect, it } from "vitest";
import { InvertedIndex } from "../invertedIndex";
import { analyze } from "../tokenizer";
import { bm25Score, idf, DEFAULT_K1, DEFAULT_B } from "../bm25";

function buildIndex(docs: { id: string; body: string }[]): InvertedIndex {
  const index = new InvertedIndex();
  for (const doc of docs) index.addDocument({ id: doc.id, title: "", body: doc.body, source: "test" });
  return index;
}

describe("bm25: matches the textbook Okapi BM25 formula exactly", () => {
  it("scores a hand-crafted two-document corpus against an independently computed expected value", () => {
    // Doc A: "cat cat dog" (3 tokens). Doc B: "dog dog dog dog" (4 tokens).
    const index = buildIndex([
      { id: "A", body: "cat cat dog" },
      { id: "B", body: "dog dog dog dog" },
    ]);

    const N = 2;
    const n = 1; // one document ("A") contains "cat"
    const expectedIdf = Math.log((N - n + 0.5) / (n + 0.5) + 1);
    expect(idf(index, "cat")).toBeCloseTo(expectedIdf, 10);

    const avgdl = (3 + 4) / 2; // 3.5
    const f = 2; // "cat" appears twice in doc A
    const dl = 3;
    const k1 = DEFAULT_K1;
    const b = DEFAULT_B;
    const expectedScore = expectedIdf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgdl))));

    expect(bm25Score(index, "A", ["cat"])).toBeCloseTo(expectedScore, 10);
    // "cat" never appears in doc B - it contributes exactly 0, not a penalty
    expect(bm25Score(index, "B", ["cat"])).toBe(0);
  });
});

describe("bm25: ranking properties a real search engine depends on", () => {
  it("ranks a document with more occurrences of the query term higher, all else being equal", () => {
    const index = buildIndex([
      { id: "low", body: "apple banana cherry date elder fig grape" },
      { id: "high", body: "apple apple apple banana cherry date elder" },
    ]);
    const queryTerms = analyze("apple");
    expect(bm25Score(index, "high", queryTerms)).toBeGreaterThan(bm25Score(index, "low", queryTerms));
  });

  it("penalizes the same single occurrence in a much longer document (length normalization)", () => {
    const index = buildIndex([
      { id: "short", body: "apple banana" },
      { id: "long", body: `apple ${"filler ".repeat(50).trim()}` },
    ]);
    const queryTerms = analyze("apple");
    expect(bm25Score(index, "short", queryTerms)).toBeGreaterThan(bm25Score(index, "long", queryTerms));
  });

  it("gives a rarer term more weight than a common one (idf effect)", () => {
    const index = buildIndex([
      { id: "1", body: "common rare" },
      { id: "2", body: "common" },
      { id: "3", body: "common" },
      { id: "4", body: "common" },
    ]);
    expect(idf(index, "rare")).toBeGreaterThan(idf(index, "common"));
  });

  it("sums scores across multiple query terms rather than only the best-matching one", () => {
    const index = buildIndex([
      { id: "both", body: "apple banana" },
      { id: "one", body: "apple only" },
    ]);
    const queryTerms = analyze("apple banana");
    const bothScore = bm25Score(index, "both", queryTerms);
    const oneScore = bm25Score(index, "one", queryTerms);
    expect(bothScore).toBeGreaterThan(oneScore);
  });
});
