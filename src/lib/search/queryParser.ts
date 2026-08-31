export interface WordTerm {
  type: "word";
  word: string;
  negated: boolean;
}

export interface PhraseTerm {
  type: "phrase";
  words: string[];
  negated: boolean;
}

export type QueryTerm = WordTerm | PhraseTerm;

/** All terms within a clause are AND'd together. */
export type QueryClause = QueryTerm[];

/** Clauses are OR'd together: `a b OR c` means (a AND b) OR c. */
export type ParsedQuery = QueryClause[];

/**
 * Grammar:
 *   Query   = Clause ("OR" Clause)*
 *   Clause  = Term+
 *   Term    = "-"? (Phrase | Word)
 *   Phrase  = '"' Word+ '"'
 *
 * "OR" is recognized only as a standalone uppercase token, matching the
 * conventional query-syntax used by most search engines (a lowercase
 * "or" inside quotes or as a plain word is just a word).
 */
export function parseQuery(raw: string): ParsedQuery {
  const rawTokens = tokenizeQueryString(raw);
  const clauses: ParsedQuery = [];
  let current: QueryClause = [];

  for (const token of rawTokens) {
    if (token.text === "OR") {
      if (current.length > 0) clauses.push(current);
      current = [];
      continue;
    }
    current.push(token.negated ? { ...token.term, negated: true } : token.term);
  }
  if (current.length > 0) clauses.push(current);

  return clauses;
}

interface RawToken {
  text: string; // only meaningful for the "OR" sentinel check
  negated: boolean;
  term: QueryTerm;
}

function tokenizeQueryString(raw: string): RawToken[] {
  const tokens: RawToken[] = [];
  let i = 0;
  const n = raw.length;

  while (i < n) {
    while (i < n && /\s/.test(raw[i])) i++;
    if (i >= n) break;

    let negated = false;
    if (raw[i] === "-") {
      negated = true;
      i++;
    }

    if (raw[i] === '"') {
      i++;
      const start = i;
      while (i < n && raw[i] !== '"') i++;
      const phraseText = raw.slice(start, i);
      if (i < n) i++; // consume closing quote
      const words = (phraseText.match(/[a-z0-9]+/gi) ?? []).map((w) => w.toLowerCase());
      if (words.length > 0) {
        tokens.push({ text: "", negated, term: { type: "phrase", words, negated } });
      }
      continue;
    }

    const start = i;
    while (i < n && !/\s/.test(raw[i])) i++;
    const word = raw.slice(start, i);
    if (word === "OR") {
      tokens.push({ text: "OR", negated: false, term: { type: "word", word: "", negated: false } });
      continue;
    }
    const cleaned = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleaned.length > 0) {
      tokens.push({ text: "", negated, term: { type: "word", word: cleaned, negated } });
    }
  }

  return tokens;
}
