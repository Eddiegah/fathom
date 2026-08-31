/**
 * The Porter Stemming Algorithm (M.F. Porter, 1980) - a deterministic,
 * rule-based reduction of English words to a common root ("running",
 * "runs", "ran" -> a shared stem) so a search index can match a query
 * term against every inflected form of a word, not just the exact
 * spelling typed. Implemented from the algorithm's published rule steps
 * (1a, 1b, 1c, 2, 3, 4, 5a, 5b), operating on the classic
 * consonant/vowel "measure" (m) of a stem.
 */

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function isConsonant(word: string, i: number): boolean {
  const ch = word[i];
  if (VOWELS.has(ch)) return false;
  if (ch !== "y") return true;
  // y is a consonant unless preceded by a consonant (i.e. y is a vowel
  // when it follows another consonant, matching Porter's definition)
  if (i === 0) return true;
  return !isConsonant(word, i - 1);
}

/** The "measure" m of a word/stem: the number of consonant-sequence ->
 * vowel-sequence transitions, per Porter's [C](VC)^m[V] form. */
function measure(word: string): number {
  let m = 0;
  let i = 0;
  const n = word.length;
  while (i < n && isConsonant(word, i)) i++; // skip leading C
  while (i < n) {
    while (i < n && !isConsonant(word, i)) i++; // V*
    if (i >= n) break;
    while (i < n && isConsonant(word, i)) i++; // C*
    m++;
  }
  return m;
}

function containsVowel(stem: string): boolean {
  for (let i = 0; i < stem.length; i++) if (!isConsonant(stem, i)) return true;
  return false;
}

function endsWithDoubleConsonant(stem: string): boolean {
  const n = stem.length;
  if (n < 2) return false;
  return stem[n - 1] === stem[n - 2] && isConsonant(stem, n - 1) && isConsonant(stem, n - 2);
}

/** cvc pattern at the end of the stem, where the final consonant is not
 * w, x, or y (Porter's *o condition). */
function endsCVC(stem: string): boolean {
  const n = stem.length;
  if (n < 3) return false;
  const c1 = isConsonant(stem, n - 3);
  const v = !isConsonant(stem, n - 2);
  const c2 = isConsonant(stem, n - 1);
  const lastLetter = stem[n - 1];
  return c1 && v && c2 && !["w", "x", "y"].includes(lastLetter);
}

function replaceSuffix(word: string, suffix: string, replacement: string): string {
  return word.slice(0, word.length - suffix.length) + replacement;
}

function step1a(word: string): string {
  if (word.endsWith("sses")) return replaceSuffix(word, "sses", "ss");
  if (word.endsWith("ies")) return replaceSuffix(word, "ies", "i");
  if (word.endsWith("ss")) return word;
  if (word.endsWith("s") && !word.endsWith("us") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function step1b(word: string): string {
  let stem: string;
  if (word.endsWith("eed")) {
    stem = word.slice(0, -3);
    return measure(stem) > 0 ? stem + "ee" : word;
  }

  let intermediate: string | null = null;
  if (word.endsWith("ed")) {
    stem = word.slice(0, -2);
    if (containsVowel(stem)) intermediate = stem;
  } else if (word.endsWith("ing")) {
    stem = word.slice(0, -3);
    if (containsVowel(stem)) intermediate = stem;
  }

  if (intermediate === null) return word;

  if (intermediate.endsWith("at") || intermediate.endsWith("bl") || intermediate.endsWith("iz")) {
    return intermediate + "e";
  }
  if (endsWithDoubleConsonant(intermediate) && !/[lsz]$/.test(intermediate)) {
    return intermediate.slice(0, -1);
  }
  if (measure(intermediate) === 1 && endsCVC(intermediate)) {
    return intermediate + "e";
  }
  return intermediate;
}

function step1c(word: string): string {
  if (word.endsWith("y")) {
    const stem = word.slice(0, -1);
    if (containsVowel(stem)) return stem + "i";
  }
  return word;
}

const STEP2_RULES: [string, string][] = [
  ["ational", "ate"],
  ["tional", "tion"],
  ["enci", "ence"],
  ["anci", "ance"],
  ["izer", "ize"],
  ["abli", "able"],
  ["alli", "al"],
  ["entli", "ent"],
  ["eli", "e"],
  ["ousli", "ous"],
  ["ization", "ize"],
  ["ation", "ate"],
  ["ator", "ate"],
  ["alism", "al"],
  ["iveness", "ive"],
  ["fulness", "ful"],
  ["ousness", "ous"],
  ["aliti", "al"],
  ["iviti", "ive"],
  ["biliti", "ble"],
];

function step2(word: string): string {
  for (const [suffix, replacement] of STEP2_RULES) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (measure(stem) > 0) return stem + replacement;
      return word;
    }
  }
  return word;
}

const STEP3_RULES: [string, string][] = [
  ["icate", "ic"],
  ["ative", ""],
  ["alize", "al"],
  ["iciti", "ic"],
  ["ical", "ic"],
  ["ful", ""],
  ["ness", ""],
];

function step3(word: string): string {
  for (const [suffix, replacement] of STEP3_RULES) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (measure(stem) > 0) return stem + replacement;
      return word;
    }
  }
  return word;
}

const STEP4_SUFFIXES = [
  "al",
  "ance",
  "ence",
  "er",
  "ic",
  "able",
  "ible",
  "ant",
  "ement",
  "ment",
  "ent",
  "ion",
  "ou",
  "ism",
  "ate",
  "iti",
  "ous",
  "ive",
  "ize",
];

function step4(word: string): string {
  for (const suffix of STEP4_SUFFIXES) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (suffix === "ion") {
        if (measure(stem) > 1 && (stem.endsWith("s") || stem.endsWith("t"))) return stem;
        continue;
      }
      if (measure(stem) > 1) return stem;
      return word;
    }
  }
  return word;
}

function step5a(word: string): string {
  if (!word.endsWith("e")) return word;
  const stem = word.slice(0, -1);
  const m = measure(stem);
  if (m > 1) return stem;
  if (m === 1 && !endsCVC(stem)) return stem;
  return word;
}

function step5b(word: string): string {
  if (measure(word) > 1 && endsWithDoubleConsonant(word) && word.endsWith("l")) {
    return word.slice(0, -1);
  }
  return word;
}

export function stem(input: string): string {
  const word = input.toLowerCase();
  if (word.length <= 2) return word;

  let result = step1a(word);
  result = step1b(result);
  result = step1c(result);
  result = step2(result);
  result = step3(result);
  result = step4(result);
  result = step5a(result);
  result = step5b(result);
  return result;
}
