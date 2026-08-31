import { describe, expect, it } from "vitest";
import { InvertedIndex } from "../invertedIndex";
import { search } from "../engine";

const CORPUS = [
  {
    id: "1",
    title: "The Fox and the Grapes",
    body: "A hungry fox spotted a bunch of ripe grapes hanging from a vine. The fox jumped and jumped but could not reach the grapes.",
  },
  {
    id: "2",
    title: "Fox Hunting Traditions",
    body: "Fox hunting is a traditional sport practiced in the countryside for centuries.",
  },
  {
    id: "3",
    title: "The Solar System",
    body: "The sun sits at the center of the solar system, with eight planets orbiting around it.",
  },
  {
    id: "4",
    title: "Photosynthesis Basics",
    body: "Plants use sunlight, water, and carbon dioxide to produce energy through photosynthesis.",
  },
  {
    id: "5",
    title: "The Clever Fox and the Crow",
    body: "A clever fox tricked a crow into dropping a piece of cheese by praising its singing voice.",
  },
];

function buildCorpusIndex(): InvertedIndex {
  const index = new InvertedIndex();
  for (const doc of CORPUS) index.addDocument({ ...doc, source: "test" });
  return index;
}

function ids(response: ReturnType<typeof search>): string[] {
  return response.results.map((r) => r.docId).sort();
}

describe("engine.search: single-term retrieval", () => {
  it("finds every document mentioning fox, and none that don't", () => {
    const index = buildCorpusIndex();
    expect(ids(search(index, "fox"))).toEqual(["1", "2", "5"]);
  });

  it("results are sorted by descending score", () => {
    const index = buildCorpusIndex();
    const { results } = search(index, "fox");
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("ranks the document with the most mentions of the query term first", () => {
    // doc 1 mentions "fox" twice in the body plus once in the title;
    // docs 2 and 5 mention it once in the body plus once in the title
    const index = buildCorpusIndex();
    const { results } = search(index, "fox");
    expect(results[0].docId).toBe("1");
  });
});

describe("engine.search: boolean AND (implicit within a clause)", () => {
  it("'fox grapes' only matches the document containing both words", () => {
    const index = buildCorpusIndex();
    expect(ids(search(index, "fox grapes"))).toEqual(["1"]);
  });

  it("a term with no matches makes the whole AND clause match nothing", () => {
    const index = buildCorpusIndex();
    expect(ids(search(index, "fox nonexistentword"))).toEqual([]);
  });
});

describe("engine.search: boolean OR", () => {
  it("'fox OR sun' matches the union, not the intersection", () => {
    const index = buildCorpusIndex();
    // doc 3 says "sun" literally; doc 4 only says "sunlight", a
    // different stem, so it must NOT match a bare "sun" query
    expect(ids(search(index, "fox OR sun"))).toEqual(["1", "2", "3", "5"]);
  });
});

describe("engine.search: negation", () => {
  it("'fox -hunting' excludes the document about fox hunting", () => {
    const index = buildCorpusIndex();
    expect(ids(search(index, "fox -hunting"))).toEqual(["1", "5"]);
  });
});

describe("engine.search: phrase queries", () => {
  it('"clever fox" matches only the document with that exact adjacent phrase', () => {
    const index = buildCorpusIndex();
    expect(ids(search(index, '"clever fox"'))).toEqual(["5"]);
  });

  it("word order inside a phrase matters - the reversed phrase matches nothing", () => {
    const index = buildCorpusIndex();
    expect(ids(search(index, '"fox clever"'))).toEqual([]);
  });

  it("a phrase spanning a stopword still matches, since positions are in the filtered token stream", () => {
    // doc 5's title is "The Clever Fox and the Crow" - "and" is a
    // stopword, so "fox and crow" must match the same way "fox crow"
    // would, both landing on the filtered positions [fox, crow]
    const index = buildCorpusIndex();
    expect(ids(search(index, '"fox and crow"'))).toEqual(["5"]);
    expect(ids(search(index, '"fox crow"'))).toEqual(["5"]);
  });

  it("a phrase built entirely from stopwords matches nothing rather than everything", () => {
    const index = buildCorpusIndex();
    expect(ids(search(index, '"the and a"'))).toEqual([]);
  });

  it("a phrase can combine with a bare word in the same clause", () => {
    const index = buildCorpusIndex();
    // doc 5 has "clever fox" AND "crow"
    expect(ids(search(index, '"clever fox" crow'))).toEqual(["5"]);
  });
});

describe("engine.search: fuzzy correction", () => {
  it("recovers results for a one-letter typo and reports the correction", () => {
    const index = buildCorpusIndex();
    const response = search(index, "foxx");
    expect(ids(response)).toEqual(["1", "2", "5"]);
    expect(response.corrections["foxx"]).toBeDefined();
  });

  it("does not correct a term that already has exact matches", () => {
    const index = buildCorpusIndex();
    const response = search(index, "fox");
    expect(response.corrections["fox"]).toBeUndefined();
  });
});

describe("engine.search: snippets", () => {
  it("produces a non-empty snippet for every result", () => {
    const index = buildCorpusIndex();
    const { results } = search(index, "fox");
    for (const result of results) expect(result.snippet.length).toBeGreaterThan(0);
  });
});

describe("engine.search: empty and unmatched queries", () => {
  it("returns no results for a blank query", () => {
    const index = buildCorpusIndex();
    expect(search(index, "").results).toEqual([]);
  });

  it("returns no results for a query matching nothing in the corpus", () => {
    const index = buildCorpusIndex();
    expect(search(index, "quantumcryptographyxyz").results).toEqual([]);
  });
});
