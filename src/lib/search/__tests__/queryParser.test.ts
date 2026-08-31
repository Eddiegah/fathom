import { describe, expect, it } from "vitest";
import { parseQuery } from "../queryParser";

describe("parseQuery: implicit AND within a clause", () => {
  it("parses bare words as a single AND clause", () => {
    const parsed = parseQuery("quick brown fox");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual([
      { type: "word", word: "quick", negated: false },
      { type: "word", word: "brown", negated: false },
      { type: "word", word: "fox", negated: false },
    ]);
  });

  it("lowercases and strips punctuation from bare words", () => {
    const parsed = parseQuery("Fox's Den!");
    expect(parsed[0]).toEqual([
      { type: "word", word: "foxs", negated: false },
      { type: "word", word: "den", negated: false },
    ]);
  });
});

describe("parseQuery: OR splits into separate clauses", () => {
  it("splits 'a b OR c' into (a AND b) OR (c)", () => {
    const parsed = parseQuery("a b OR c");
    expect(parsed).toEqual([
      [
        { type: "word", word: "a", negated: false },
        { type: "word", word: "b", negated: false },
      ],
      [{ type: "word", word: "c", negated: false }],
    ]);
  });

  it("supports more than two OR'd clauses", () => {
    const parsed = parseQuery("a OR b OR c");
    expect(parsed).toHaveLength(3);
    expect(parsed.map((clause) => clause[0].type === "word" && clause[0].word)).toEqual(["a", "b", "c"]);
  });

  it("does not treat a lowercase 'or' as the OR operator", () => {
    const parsed = parseQuery("apples or oranges");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].map((t) => t.type === "word" && t.word)).toEqual(["apples", "or", "oranges"]);
  });
});

describe("parseQuery: negation", () => {
  it("marks a hyphen-prefixed word as negated", () => {
    const parsed = parseQuery("fox -hunting");
    expect(parsed[0]).toEqual([
      { type: "word", word: "fox", negated: false },
      { type: "word", word: "hunting", negated: true },
    ]);
  });

  it("marks a hyphen-prefixed phrase as negated", () => {
    const parsed = parseQuery('fox -"red herring"');
    expect(parsed[0][1]).toEqual({ type: "phrase", words: ["red", "herring"], negated: true });
  });
});

describe("parseQuery: phrase queries", () => {
  it("parses a quoted phrase as a single phrase term preserving word order", () => {
    const parsed = parseQuery('"quick brown fox"');
    expect(parsed[0]).toEqual([{ type: "phrase", words: ["quick", "brown", "fox"], negated: false }]);
  });

  it("allows a phrase and bare words in the same clause", () => {
    const parsed = parseQuery('"exact phrase" extra');
    expect(parsed[0]).toEqual([
      { type: "phrase", words: ["exact", "phrase"], negated: false },
      { type: "word", word: "extra", negated: false },
    ]);
  });

  it("tolerates an unterminated quote by treating the rest of the string as the phrase", () => {
    const parsed = parseQuery('"quick brown');
    expect(parsed[0]).toEqual([{ type: "phrase", words: ["quick", "brown"], negated: false }]);
  });
});

describe("parseQuery: edge cases", () => {
  it("returns an empty query for blank input", () => {
    expect(parseQuery("")).toEqual([]);
    expect(parseQuery("   ")).toEqual([]);
  });

  it("collapses repeated whitespace", () => {
    const parsed = parseQuery("fox    hunting");
    expect(parsed[0]).toHaveLength(2);
  });
});
