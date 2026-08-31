import type { InvertedIndex } from "./invertedIndex";

export const DEFAULT_K1 = 1.5;
export const DEFAULT_B = 0.75;

/** Okapi BM25's inverse document frequency term, using the "+1"
 * smoothed form so common terms never produce a negative weight (the
 * classic unsmoothed idf(t) = ln(N/n(t)) goes negative once a term
 * appears in more than half the corpus). */
export function idf(index: InvertedIndex, term: string): number {
  const n = index.getPostings(term).length;
  const N = index.totalDocs;
  return Math.log((N - n + 0.5) / (n + 0.5) + 1);
}

/** The BM25 score of a single document for a single term, before
 * summing across all query terms. */
function termScore(index: InvertedIndex, term: string, docId: string, k1: number, b: number): number {
  const posting = index.getPostings(term).find((p) => p.docId === docId);
  if (!posting) return 0;

  const doc = index.getDocument(docId);
  if (!doc) return 0;

  const f = posting.termFrequency;
  const dl = doc.tokenCount;
  const avgdl = index.avgDocLength || 1;

  const numerator = f * (k1 + 1);
  const denominator = f + k1 * (1 - b + b * (dl / avgdl));
  return idf(index, term) * (numerator / denominator);
}

/** BM25(D, Q) = sum over query terms of idf(t) * termScore(t, D). Terms
 * the document doesn't contain contribute exactly 0, not a penalty -
 * BM25 rewards presence, it doesn't punish absence beyond that. */
export function bm25Score(
  index: InvertedIndex,
  docId: string,
  queryTerms: string[],
  k1: number = DEFAULT_K1,
  b: number = DEFAULT_B,
): number {
  return queryTerms.reduce((sum, term) => sum + termScore(index, term, docId, k1, b), 0);
}
