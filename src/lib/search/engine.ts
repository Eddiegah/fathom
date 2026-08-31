import { bm25Score } from "./bm25";
import { findClosestTerms } from "./fuzzy";
import type { InvertedIndex } from "./invertedIndex";
import { parseQuery, type ParsedQuery, type QueryClause, type QueryTerm } from "./queryParser";
import { stem } from "./stemmer";
import { STOPWORDS } from "./stopwords";

export interface SearchResult {
  docId: string;
  title: string;
  source: string;
  score: number;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  /** the raw (unstemmed) positive query words - what the UI highlights
   * inside each snippet, so a result visibly shows *why* it matched. */
  matchedWords: string[];
  /** original typed word -> the vocabulary term it was corrected to,
   * only present for word terms that had zero exact matches. */
  corrections: Record<string, string>;
}

interface ResolvedWordTerm {
  matchStem: string;
  original: string;
  correctedFrom: string | null;
}

function resolveWordTerm(index: InvertedIndex, word: string, fuzzyMaxDistance: number): ResolvedWordTerm {
  const exact = stem(word);
  if (index.getPostings(exact).length > 0) {
    return { matchStem: exact, original: word, correctedFrom: null };
  }

  const [closest] = findClosestTerms(exact, index.vocabulary(), fuzzyMaxDistance, 1);
  if (closest) return { matchStem: closest, original: word, correctedFrom: word };

  return { matchStem: exact, original: word, correctedFrom: null };
}

function docIdsForPhrase(index: InvertedIndex, stems: string[]): Set<string> {
  if (stems.length === 0) return new Set();
  const postingsPerWord = stems.map((s) => index.getPostings(s));
  if (postingsPerWord.some((p) => p.length === 0)) return new Set();

  const [first, ...rest] = postingsPerWord;
  const matches = new Set<string>();

  for (const firstPosting of first) {
    const restPostings = rest.map((postings) => postings.find((p) => p.docId === firstPosting.docId));
    if (restPostings.some((p) => p === undefined)) continue;

    for (const startPos of firstPosting.positions) {
      const isSequential = restPostings.every((posting, offset) => posting!.positions.includes(startPos + offset + 1));
      if (isSequential) {
        matches.add(firstPosting.docId);
        break;
      }
    }
  }

  return matches;
}

function intersect(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  const [first, ...rest] = sets;
  return new Set(Array.from(first).filter((id) => rest.every((s) => s.has(id))));
}

function union(sets: Set<string>[]): Set<string> {
  const result = new Set<string>();
  for (const s of sets) for (const id of s) result.add(id);
  return result;
}

interface ClauseResolution {
  docIds: Set<string>;
  scoringStems: Set<string>;
  corrections: Record<string, string>;
}

function resolveClause(index: InvertedIndex, clause: QueryClause, fuzzyMaxDistance: number): ClauseResolution {
  const corrections: Record<string, string> = {};
  const scoringStems = new Set<string>();
  const positiveSets: Set<string>[] = [];
  const negativeSets: Set<string>[] = [];

  for (const term of clause) {
    const docIds = resolveTerm(index, term, fuzzyMaxDistance, scoringStems, corrections);
    if (term.negated) negativeSets.push(docIds);
    else positiveSets.push(docIds);
  }

  if (positiveSets.length === 0) return { docIds: new Set(), scoringStems, corrections };

  const positiveMatch = intersect(positiveSets);
  const excluded = union(negativeSets);
  const docIds = new Set(Array.from(positiveMatch).filter((id) => !excluded.has(id)));

  return { docIds, scoringStems, corrections };
}

function resolveTerm(
  index: InvertedIndex,
  term: QueryTerm,
  fuzzyMaxDistance: number,
  scoringStems: Set<string>,
  corrections: Record<string, string>,
): Set<string> {
  if (term.type === "word") {
    const resolved = resolveWordTerm(index, term.word, fuzzyMaxDistance);
    if (resolved.correctedFrom) corrections[resolved.correctedFrom] = resolved.matchStem;
    if (!term.negated) scoringStems.add(resolved.matchStem);
    return new Set(index.getPostings(resolved.matchStem).map((p) => p.docId));
  }

  // Positions in the index are offsets into the post-stopword-filtered
  // token stream (see tokenizer.ts), so a phrase query has to filter
  // stopwords the same way before checking adjacency - otherwise a
  // phrase like "clever fox" would never match, since its filtered
  // index position for "fox" doesn't line up with the unfiltered word
  // count. Phrases built mostly or entirely from stopwords ("to be or
  // not to be") necessarily degrade to matching on whatever content
  // words remain - a known, documented limit of stopword-filtered
  // indexing, not a bug.
  const stems = term.words.filter((w) => !STOPWORDS.has(w)).map((w) => stem(w));
  if (!term.negated) for (const s of stems) scoringStems.add(s);
  return docIdsForPhrase(index, stems);
}

function buildSnippet(body: string, positiveWords: string[], maxLength: number = 180): string {
  const lower = body.toLowerCase();
  let matchIndex = -1;
  for (const word of positiveWords) {
    const idx = lower.indexOf(word.toLowerCase());
    if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) matchIndex = idx;
  }

  if (matchIndex === -1) {
    return body.length <= maxLength ? body : body.slice(0, maxLength).trimEnd() + "...";
  }

  const start = Math.max(0, matchIndex - 60);
  const end = Math.min(body.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < body.length ? "..." : "";
  return prefix + body.slice(start, end).trim() + suffix;
}

export function search(index: InvertedIndex, rawQuery: string, options: { limit?: number; fuzzyMaxDistance?: number } = {}): SearchResponse {
  const limit = options.limit ?? 20;
  const fuzzyMaxDistance = options.fuzzyMaxDistance ?? 2;

  const parsed: ParsedQuery = parseQuery(rawQuery);
  if (parsed.length === 0) return { results: [], matchedWords: [], corrections: {} };

  const clauseResolutions = parsed.map((clause) => resolveClause(index, clause, fuzzyMaxDistance));
  const matchingDocIds = union(clauseResolutions.map((c) => c.docIds));

  const scoringStems = Array.from(union(clauseResolutions.map((c) => new Set(c.scoringStems))));
  const corrections = Object.assign({}, ...clauseResolutions.map((c) => c.corrections));

  const positiveWords = parsed
    .flatMap((clause) => clause)
    .filter((t) => !t.negated)
    .flatMap((t) => (t.type === "word" ? [t.word] : t.words));

  const results: SearchResult[] = Array.from(matchingDocIds)
    .map((docId) => {
      const doc = index.getDocument(docId)!;
      return {
        docId,
        title: doc.title,
        source: doc.source,
        score: bm25Score(index, docId, scoringStems),
        snippet: buildSnippet(doc.body, positiveWords),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { results, matchedWords: Array.from(new Set(positiveWords)), corrections };
}
