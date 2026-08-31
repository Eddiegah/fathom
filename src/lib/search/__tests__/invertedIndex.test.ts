import { describe, expect, it } from "vitest";
import { InvertedIndex } from "../invertedIndex";
import { analyze } from "../tokenizer";

const DOCS = [
  { id: "1", title: "The Quick Fox", body: "The quick brown fox jumps over the lazy dog.", source: "test" },
  { id: "2", title: "Foxes at Night", body: "Foxes are nocturnal. A fox hunts at night for food.", source: "test" },
  { id: "3", title: "Unrelated", body: "Bananas are a good source of potassium.", source: "test" },
];

function buildTestIndex(): InvertedIndex {
  const index = new InvertedIndex();
  for (const doc of DOCS) index.addDocument(doc);
  return index;
}

/** Brute-force ground truth: does this document actually contain the
 * stemmed term, counted independently of the index's own bookkeeping. */
function bruteForceContains(doc: (typeof DOCS)[number], term: string): number {
  const tokens = analyze(`${doc.title} ${doc.body}`);
  return tokens.filter((t) => t === term).length;
}

describe("InvertedIndex: postings match a brute-force scan", () => {
  const index = buildTestIndex();

  it("finds 'fox' in documents 1 and 2, not 3, with correct term frequencies", () => {
    const postings = index.getPostings("fox"); // stem of fox/foxes
    const docIds = postings.map((p) => p.docId).sort();
    expect(docIds).toEqual(["1", "2"]);

    for (const posting of postings) {
      const doc = DOCS.find((d) => d.id === posting.docId)!;
      expect(posting.termFrequency).toBe(bruteForceContains(doc, "fox"));
    }
  });

  it("returns an empty postings list for a term that appears nowhere", () => {
    expect(index.getPostings("xylophone")).toEqual([]);
  });

  it("stems 'foxes' and 'fox' to the same postings entry", () => {
    // doc 2's title and body together contain "Foxes" (x2) and "fox"
    // (x1) - all three should count toward the same term's posting
    const posting = index.getPostings("fox").find((p) => p.docId === "2")!;
    expect(posting.termFrequency).toBe(3);
  });

  it("records token positions that are strictly increasing and within range", () => {
    for (const term of index.vocabulary()) {
      for (const posting of index.getPostings(term)) {
        const doc = index.getDocument(posting.docId)!;
        for (let i = 1; i < posting.positions.length; i++) {
          expect(posting.positions[i]).toBeGreaterThan(posting.positions[i - 1]);
        }
        for (const pos of posting.positions) {
          expect(pos).toBeGreaterThanOrEqual(0);
          expect(pos).toBeLessThan(doc.tokenCount);
        }
      }
    }
  });

  it("computes document count and average length correctly", () => {
    expect(index.totalDocs).toBe(3);
    const expectedAvg = DOCS.reduce((sum, d) => sum + analyze(`${d.title} ${d.body}`).length, 0) / DOCS.length;
    expect(index.avgDocLength).toBeCloseTo(expectedAvg, 6);
  });

  it("rejects adding a document with a duplicate id", () => {
    const fresh = buildTestIndex();
    expect(() => fresh.addDocument({ id: "1", title: "dup", body: "dup", source: "test" })).toThrow(/duplicate/i);
  });

  it("round-trips through serialization without losing postings or stats", () => {
    const serialized = index.toJSON();
    const restored = InvertedIndex.fromJSON(serialized);
    expect(restored.totalDocs).toBe(index.totalDocs);
    expect(restored.getPostings("fox").map((p: { docId: string }) => p.docId).sort()).toEqual(
      index.getPostings("fox").map((p) => p.docId).sort(),
    );
  });
});
