/** Classic Wagner-Fischer edit distance: the minimum number of single-
 * character insertions, deletions, or substitutions to turn `a` into
 * `b`. Used for typo-tolerant search - if a query term isn't in the
 * vocabulary, the closest real term within a small edit-distance budget
 * is suggested/substituted instead of returning zero results. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/** The closest term(s) in `vocabulary` to `term`, within `maxDistance`
 * edits, nearest first. Only consulted when `term` isn't already an
 * exact vocabulary hit - this is a fallback, not a replacement for
 * exact matching. */
export function findClosestTerms(term: string, vocabulary: Iterable<string>, maxDistance: number = 2, limit: number = 5): string[] {
  const scored: { term: string; distance: number }[] = [];
  for (const candidate of vocabulary) {
    // skip candidates whose length alone rules out being within budget -
    // a cheap filter before paying for the full O(mn) distance
    if (Math.abs(candidate.length - term.length) > maxDistance) continue;
    const distance = editDistance(term, candidate);
    if (distance <= maxDistance) scored.push({ term: candidate, distance });
  }
  scored.sort((a, b) => a.distance - b.distance || a.term.localeCompare(b.term));
  return scored.slice(0, limit).map((s) => s.term);
}
