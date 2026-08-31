import { stem } from "./stemmer";
import { STOPWORDS } from "./stopwords";

/** Splits raw text into lowercase word tokens, discarding punctuation
 * and any run of characters that isn't a letter or digit. */
export function splitWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9]+/g);
  return matches ?? [];
}

/** The full indexing/query pipeline: split -> drop stopwords -> stem.
 * Both documents and queries go through this exact same function, which
 * is what makes stemmed/stopword-filtered matching work at all - a
 * query for "the running fox" and a document containing "foxes run"
 * only meet in the middle because both sides were folded the same way. */
export function analyze(text: string): string[] {
  return splitWords(text)
    .filter((word) => !STOPWORDS.has(word))
    .map(stem);
}
